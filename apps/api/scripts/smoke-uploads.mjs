import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const API = process.env.API_PROXY_URL || "http://localhost:3001";
const BASE = `${API.replace(/\/$/, "")}/api/v1`;
const prisma = new PrismaClient();

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

function parseCookies(response) {
  const raw = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const jar = new Map();
  for (const item of raw) {
    const [pair] = item.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
  return jar;
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function request(pathname, { method = "GET", jar, body, headers = {} } = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      ...(jar ? { cookie: cookieHeader(jar), "x-csrf-token": jar.get("csrf") || "" } : {}),
      "x-requested-with": "vendor-portal",
      ...headers,
    },
    body,
  });
  const next = new Map(jar || []);
  for (const [k, v] of parseCookies(response)) next.set(k, v);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: response.status, ok: response.ok, json, jar: next, text };
}

async function login(email, password) {
  const first = await request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!first.ok) throw new Error(`Login failed for ${email}: ${first.status} ${JSON.stringify(first.json)}`);
  return first.jar;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const results = [];
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@projects7.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Projects7@2026";

  const health = await request("/health");
  assert(health.ok, `API health failed: ${health.status}`);
  results.push(["health", "ok"]);

  const adminJar = await login(adminEmail, adminPassword);
  results.push(["admin login", "ok"]);

  const vendor = await prisma.vendor.findFirst({
    where: { archivedAt: null, users: { some: { status: "ACTIVE" } } },
    include: { users: { where: { status: "ACTIVE" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
  assert(vendor?.users[0], "No active vendor user found for smoke test.");

  const assignment = await prisma.formAssignment.findFirst({
    where: { vendorId: vendor.id, status: { not: "REVOKED" } },
    orderBy: { createdAt: "desc" },
  });
  assert(assignment, "No form assignment found for the vendor.");

  // Temporary password for the vendor account so we can authenticate.
  const tempPassword = `Smoke-${randomUUID().slice(0, 8)}!aA1`;
  const argon2 = await import("@node-rs/argon2");
  const passwordHash = await argon2.hash(tempPassword, {
    algorithm: argon2.Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
  await prisma.user.update({
    where: { id: vendor.users[0].id },
    data: { passwordHash, mustChangePassword: false, status: "ACTIVE" },
  });

  const vendorJar = await login(vendor.users[0].email, tempPassword);
  results.push(["vendor login", "ok"]);

  const imageBody = new FormData();
  imageBody.set("file", new Blob([png], { type: "image/png" }), "signature.png");
  imageBody.set("assignmentId", assignment.id);
  const imageUpload = await request("/documents", { method: "POST", jar: vendorJar, body: imageBody });
  assert(imageUpload.ok, `Vendor image upload failed: ${imageUpload.status} ${JSON.stringify(imageUpload.json)}`);
  assert(imageUpload.json?.data?.id, "Vendor image upload missing document id.");
  results.push(["vendor image upload", imageUpload.json.data.id]);

  const pdfBody = new FormData();
  pdfBody.set("file", new Blob([pdf], { type: "application/pdf" }), "compliance.pdf");
  pdfBody.set("assignmentId", assignment.id);
  const pdfUpload = await request("/documents", { method: "POST", jar: vendorJar, body: pdfBody });
  assert(pdfUpload.ok, `Vendor PDF upload failed: ${pdfUpload.status} ${JSON.stringify(pdfUpload.json)}`);
  assert(pdfUpload.json?.data?.id, "Vendor PDF upload missing document id.");
  results.push(["vendor pdf upload", pdfUpload.json.data.id]);

  const imageGet = await request(`/documents/${imageUpload.json.data.id}/content`, { jar: vendorJar });
  assert(imageGet.ok, `Vendor image download failed: ${imageGet.status}`);
  results.push(["vendor image download", `${imageGet.status}`]);

  const adminDocBody = new FormData();
  adminDocBody.set("file", new Blob([png], { type: "image/png" }), "admin-check.png");
  adminDocBody.set("vendorId", vendor.id);
  const adminUpload = await request("/documents", { method: "POST", jar: adminJar, body: adminDocBody });
  assert(adminUpload.ok, `Admin document upload failed: ${adminUpload.status} ${JSON.stringify(adminUpload.json)}`);
  results.push(["admin document upload", adminUpload.json.data.id]);

  const template = await prisma.formTemplate.findFirst({
    where: { archivedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  if (template) {
    const assetBody = new FormData();
    assetBody.set("file", new Blob([pdf], { type: "application/pdf" }), "blank-form.pdf");
    const assetUpload = await request(`/forms/${template.id}/assets`, { method: "POST", jar: adminJar, body: assetBody });
    if (assetUpload.ok) {
      results.push(["admin form asset upload", assetUpload.json?.data?.id || "ok"]);
    } else {
      results.push(["admin form asset upload", `skipped/fail ${assetUpload.status} ${JSON.stringify(assetUpload.json).slice(0, 160)}`]);
    }
  } else {
    results.push(["admin form asset upload", "skipped (no template)"]);
  }

  const exhibition = await prisma.exhibition.findFirst({ where: { status: { not: "ARCHIVED" } }, orderBy: { createdAt: "desc" } });
  if (exhibition) {
    const packetBody = new FormData();
    packetBody.set("name", `Smoke PDF ${Date.now()}`);
    packetBody.set("file", new Blob([pdf], { type: "application/pdf" }), "packet-blank.pdf");
    const packetUpload = await request(`/exhibitions/${exhibition.id}/pdf-forms`, { method: "POST", jar: adminJar, body: packetBody });
    if (packetUpload.ok) {
      results.push(["admin exhibition pdf upload", packetUpload.json?.data?.id || "ok"]);
    } else {
      results.push(["admin exhibition pdf upload", `skipped/fail ${packetUpload.status} ${JSON.stringify(packetUpload.json).slice(0, 160)}`]);
    }
  } else {
    results.push(["admin exhibition pdf upload", "skipped (no exhibition)"]);
  }

  const storageDir = path.resolve(process.env.STORAGE_LOCAL_DIR || "storage");
  await mkdir(storageDir, { recursive: true });
  await writeFile(path.join(storageDir, ".smoke-ok"), createHash("sha256").update(String(Date.now())).digest("hex"));

  console.log(JSON.stringify({ ok: true, vendor: vendor.companyName, assignmentId: assignment.id, results }, null, 2));
}

main()
  .catch(async (error) => {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
