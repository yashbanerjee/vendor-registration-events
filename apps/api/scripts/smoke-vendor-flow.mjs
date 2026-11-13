import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const API = process.env.API_PROXY_URL || "http://localhost:3001";
const BASE = `${API.replace(/\/$/, "")}/api/v1`;
const prisma = new PrismaClient();

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

async function main() {
  const results = [];
  const vendor = await prisma.vendor.findFirst({
    where: {
      archivedAt: null,
      users: { some: { status: "ACTIVE" } },
      assignments: { some: { status: { in: ["INVITED", "IN_PROGRESS", "CORRECTION_REQUESTED"] } } },
    },
    include: {
      users: { where: { status: "ACTIVE" }, take: 1 },
      assignments: {
        where: { status: { in: ["INVITED", "IN_PROGRESS", "CORRECTION_REQUESTED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
  assert(vendor?.users[0] && vendor.assignments[0], "No editable vendor assignment found.");

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

  const jar = await login(vendor.users[0].email, tempPassword);
  results.push(["vendor login", "ok"]);

  const assignmentId = vendor.assignments[0].id;
  const get = await request(`/assignments/${assignmentId}`, { jar });
  assert(get.ok, `Get assignment failed: ${get.status} ${JSON.stringify(get.json)}`);
  const assignment = get.json.data;
  results.push(["get assignment", assignment.status]);

  const uploadBody = new FormData();
  uploadBody.set("file", new Blob([png], { type: "image/png" }), "smoke-signature.png");
  uploadBody.set("assignmentId", assignmentId);
  const imageField = assignment.form.schema.fields.find((field) => field.type === "image" || field.type === "file" || field.type === "files");
  if (imageField) uploadBody.set("fieldId", imageField.id);
  const upload = await request("/documents", { method: "POST", jar, body: uploadBody });
  assert(upload.ok, `Upload failed: ${upload.status} ${JSON.stringify(upload.json)}`);
  const documentId = upload.json.data.id;
  results.push(["upload", documentId]);

  const download = await request(`/documents/${documentId}/content`, { jar });
  assert(download.ok, `Download failed: ${download.status}`);
  results.push(["download", String(download.status)]);

  const values = { ...(assignment.values || {}) };
  if (imageField) {
    values[imageField.id] = {
      documentId,
      filename: "smoke-signature.png",
    };
  }

  const draft = await request(`/assignments/${assignmentId}/draft`, {
    method: "PUT",
    jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lockVersion: assignment.lockVersion, values }),
  });
  assert(draft.ok, `Save draft failed: ${draft.status} ${JSON.stringify(draft.json)}`);
  results.push(["save draft", draft.json.data.status]);

  const afterDraft = draft.json.data;
  const editable = ["INVITED", "IN_PROGRESS", "CORRECTION_REQUESTED"].includes(afterDraft.status);
  if (editable) {
    // Fill required non-file fields with simple placeholders so submit can succeed when possible.
    for (const field of afterDraft.form.schema.fields) {
      if (!field.required) continue;
      if (["file", "files", "image", "reupload"].includes(field.type)) {
        if (!values[field.id] && imageField && field.id === imageField.id) continue;
        if (!values[field.id]) {
          values[field.id] = { documentId, filename: "smoke-signature.png" };
        }
        continue;
      }
      if (values[field.id] != null && values[field.id] !== "") continue;
      if (field.type === "email") values[field.id] = vendor.users[0].email;
      else if (field.type === "number") values[field.id] = 1;
      else if (field.type === "date") values[field.id] = "2026-11-12";
      else if (field.type === "checkbox" || field.type === "boolean") values[field.id] = true;
      else if (field.type === "select" && field.options?.length) values[field.id] = field.options[0].value ?? field.options[0];
      else values[field.id] = "Smoke test";
    }

    const submit = await request(`/assignments/${assignmentId}/submit`, {
      method: "POST",
      jar,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lockVersion: afterDraft.lockVersion, values }),
    });
    if (submit.ok) {
      results.push(["submit", submit.json.data.status]);
    } else {
      results.push(["submit", `blocked ${submit.status}: ${(submit.json?.error?.message || "").slice(0, 160)}`]);
    }
  } else {
    results.push(["submit", `skipped status=${afterDraft.status}`]);
  }

  console.log(JSON.stringify({ ok: true, vendor: vendor.companyName, assignmentId, results }, null, 2));
}

main()
  .catch(async (error) => {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
