import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { type INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AppModule } from "../src/app.module";
import { resetEnvCache } from "../src/config/env";
import { PrismaService, TenantService } from "../src/prisma/prisma.service";
import { OutboxProcessor } from "../src/jobs/jobs.service";
import { decryptString } from "../src/common/crypto";

process.env.NODE_ENV = "test";
process.env.JOBS_MODE = "inline";
process.env.PROCESS_ROLE = "api";
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_LOCAL_DIR = "storage-test";
process.env.ENABLE_SWAGGER = "false";
process.env.SMTP_HOST = "json";
process.env.COOKIE_SECURE = "false";
process.env.WEB_ORIGIN = "http://localhost:3000";
resetEnvCache();

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@harbor.example";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Admin1";

function csrfOf(response: request.Response) {
  const cookies = response.get("set-cookie") as unknown as string[];
  const line = cookies.find((cookie) => cookie.startsWith("csrf="));
  if (!line) throw new Error("Missing csrf cookie");
  return decodeURIComponent(line.split(";")[0].slice(5));
}

test("milestone workflow, tenant isolation, and idempotent retry", async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  await app.init();
  const server = app.getHttpServer();
  const tenant = app.get(TenantService);
  const prisma = app.get(PrismaService);
  const processor = app.get(OutboxProcessor);

  const admin = request.agent(server);
  const login = await admin.post("/api/v1/auth/login").send({ email: adminEmail, password: adminPassword });
  assert.equal(login.status, 201, JSON.stringify(login.body));
  const csrf = csrfOf(login);
  const authed = () => ({ "x-csrf-token": csrf });

  const suffix = randomUUID().slice(0, 8);
  const exhibition = await admin.post("/api/v1/exhibitions").set(authed()).send({
    name: `Harbor ${suffix}`,
    code: `HL${suffix}`,
    venue: "Hall A",
    startsAt: "2026-11-12T09:00:00.000Z",
    endsAt: "2026-11-15T18:00:00.000Z",
    status: "PUBLISHED",
  });
  assert.equal(exhibition.status, 201, JSON.stringify(exhibition.body));

  const vendorEmail = `vendor.${suffix}@example.com`;
  const vendor = await admin.post("/api/v1/vendors").set(authed()).send({
    companyName: `Acme ${suffix}`,
    contactName: "Riley Chen",
    email: vendorEmail,
    category: "Lighting",
  });
  assert.equal(vendor.status, 201, JSON.stringify(vendor.body));

  const other = await admin.post("/api/v1/vendors").set(authed()).send({
    companyName: `Other ${suffix}`,
    contactName: "Sam Patel",
    email: `other.${suffix}@example.com`,
    category: "Signage",
  });
  assert.equal(other.status, 201);

  const sectionId = randomUUID();
  const companyId = randomUUID();
  const boothId = randomUUID();
  const fileId = randomUUID();
  const form = await admin.post("/api/v1/forms").set(authed()).send({ name: `Booth ${suffix}`, scope: "GLOBAL" });
  assert.equal(form.status, 201, JSON.stringify(form.body));
  const draft = await admin.put(`/api/v1/forms/${form.body.data.id}/draft`).set(authed()).send({
    name: `Booth ${suffix}`,
    scope: "GLOBAL",
    schema: {
      sections: [{ id: sectionId, title: "Booth", description: "", order: 0 }],
      fields: [
        { id: companyId, key: "company", type: "text", label: "Company", required: true, sectionId, order: 0 },
        { id: boothId, key: "booth", type: "text", label: "Booth", required: true, sectionId, order: 1 },
        { id: fileId, key: "plan", type: "file", label: "Floor plan", required: true, sectionId, order: 2 },
      ],
    },
  });
  assert.equal(draft.status, 200, JSON.stringify(draft.body));
  const published = await admin.post(`/api/v1/forms/${form.body.data.id}/publish`).set(authed()).send({});
  assert.equal(published.status, 201, JSON.stringify(published.body));

  const assignment = await admin.post("/api/v1/assignments").set(authed()).send({
    vendorId: vendor.body.data.id,
    exhibitionId: exhibition.body.data.id,
    formVersionId: published.body.data.id,
    deadline: "2026-11-01T00:00:00.000Z",
  });
  assert.equal(assignment.status, 201, JSON.stringify(assignment.body));
  await processor.flush();

  const token = await latestInviteToken(tenant, vendorEmail);

  const vendorAgent = request.agent(server);
  const accepted = await vendorAgent.post("/api/v1/auth/invitations/accept").send({
    token,
    name: "Riley Chen",
    password: "VendorPass!2026",
  });
  assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
  const vendorCsrf = csrfOf(accepted);

  const upload = await vendorAgent
    .post("/api/v1/documents")
    .set("x-csrf-token", vendorCsrf)
    .field("assignmentId", assignment.body.data.id)
    .field("fieldId", fileId)
    .attach("file", Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"), { filename: "plan.pdf", contentType: "application/pdf" });
  assert.equal(upload.status, 201, JSON.stringify(upload.body));
  assert.equal(upload.body.data.status, "AVAILABLE");

  const values = {
    [companyId]: "Acme Lighting",
    [boothId]: "B-14",
    [fileId]: { documentId: upload.body.data.id, filename: "plan.pdf" },
  };
  const current = await vendorAgent.get(`/api/v1/assignments/${assignment.body.data.id}`);
  const submitted = await vendorAgent.post(`/api/v1/assignments/${assignment.body.data.id}/submit`).set("x-csrf-token", vendorCsrf).send({
    lockVersion: current.body.data.lockVersion,
    values,
  });
  assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
  assert.equal(submitted.body.data.status, "SUBMITTED_PENDING_REVIEW");
  await processor.flush();

  const correction = await admin.post(`/api/v1/assignments/${assignment.body.data.id}/corrections`).set(authed()).send({
    lockVersion: submitted.body.data.lockVersion,
    fields: [
      { fieldId: companyId, note: "Use the legal company name." },
      { fieldId: boothId, note: "Booth B-18 was confirmed." },
    ],
  });
  assert.equal(correction.status, 201, JSON.stringify(correction.body));
  await processor.flush();

  const tamper = await vendorAgent.post(`/api/v1/assignments/${assignment.body.data.id}/submit`).set("x-csrf-token", vendorCsrf).send({
    lockVersion: correction.body.data.lockVersion,
    values: { ...values, [companyId]: "Changed legally", extra: true },
  });
  assert.equal(tamper.status, 409);
  assert.equal(tamper.body.error.code, "FIELD_LOCKED");

  const lockedFile = await vendorAgent.post(`/api/v1/assignments/${assignment.body.data.id}/submit`).set("x-csrf-token", vendorCsrf).send({
    lockVersion: correction.body.data.lockVersion,
    values: { ...values, [companyId]: "Acme Lighting LLC", [boothId]: "B-18", [fileId]: { documentId: randomUUID(), filename: "other.pdf" } },
  });
  assert.equal(lockedFile.status, 409);

  const resubmit = await vendorAgent.post(`/api/v1/assignments/${assignment.body.data.id}/submit`).set("x-csrf-token", vendorCsrf).send({
    lockVersion: correction.body.data.lockVersion,
    values: { ...values, [companyId]: "Acme Lighting LLC", [boothId]: "B-18" },
  });
  assert.equal(resubmit.status, 201, JSON.stringify(resubmit.body));
  assert.equal(resubmit.body.data.status, "RESUBMITTED_PENDING_REVIEW");

  const approved = await admin.post(`/api/v1/assignments/${assignment.body.data.id}/approve`).set(authed()).send({
    lockVersion: resubmit.body.data.lockVersion,
  });
  assert.equal(approved.status, 201, JSON.stringify(approved.body));
  assert.equal(approved.body.data.status, "APPROVED");
  await processor.flush();

  const lockedEdit = await vendorAgent.put(`/api/v1/assignments/${assignment.body.data.id}/draft`).set("x-csrf-token", vendorCsrf).send({
    lockVersion: approved.body.data.lockVersion,
    values,
  });
  assert.equal(lockedEdit.status, 409);

  const archive = await admin.get(`/api/v1/documents/archive/${vendor.body.data.id}`).set(authed());
  assert.equal(archive.status, 200);
  assert.ok(archive.body.data.documents.some((document: { id: string }) => document.id === upload.body.data.id));

  const otherAssignment = await admin.post("/api/v1/assignments").set(authed()).send({
    vendorId: other.body.data.id,
    exhibitionId: exhibition.body.data.id,
    formVersionId: published.body.data.id,
  });
  assert.equal(otherAssignment.status, 201, JSON.stringify(otherAssignment.body));
  await processor.flush();
  const otherToken = await latestInviteToken(tenant, `other.${suffix}@example.com`);
  const otherAgent = request.agent(server);
  const otherAccepted = await otherAgent.post("/api/v1/auth/invitations/accept").send({
    token: otherToken,
    name: "Sam Patel",
    password: "VendorPass!2026",
  });
  assert.equal(otherAccepted.status, 201, JSON.stringify(otherAccepted.body));
  const otherCsrf = csrfOf(otherAccepted);
  const foreignAssignment = await otherAgent.get(`/api/v1/assignments/${assignment.body.data.id}`).set("x-csrf-token", otherCsrf);
  assert.equal(foreignAssignment.status, 404);
  const foreignDoc = await otherAgent.get(`/api/v1/documents/${upload.body.data.id}/content`).set("x-csrf-token", otherCsrf);
  assert.equal(foreignDoc.status, 404);

  const emails = await tenant.unscoped((tx) => tx.emailMessage.findMany({ where: { toAddress: vendorEmail, template: "approved" } }));
  assert.equal(emails.length, 1);
  assert.equal(emails[0].status, "SENT");
  const approvalEvent = await tenant.unscoped((tx) => tx.outboxEvent.findFirst({ where: { idempotencyKey: emails[0].idempotencyKey } }));
  assert.ok(approvalEvent);
  await tenant.unscoped((tx) => tx.outboxEvent.update({ where: { id: approvalEvent.id }, data: { status: "FAILED", lastError: "forced" } }));
  const retried = await admin.post(`/api/v1/jobs/${approvalEvent.id}/retry`).set(authed()).send({});
  assert.equal(retried.status, 201, JSON.stringify(retried.body));
  const emailsAfter = await tenant.unscoped((tx) => tx.emailMessage.findMany({ where: { idempotencyKey: emails[0].idempotencyKey } }));
  assert.equal(emailsAfter.length, 1);

  const allAudits = await tenant.unscoped((tx) => tx.auditLog.findMany({ where: { vendorId: vendor.body.data.id } }));
  const vendorActions = new Set(allAudits.map((entry) => entry.action));
  for (const action of ["assignment.created", "submission.submitted", "correction.requested", "submission.resubmitted", "submission.approved", "document.uploaded"]) {
    assert.ok(vendorActions.has(action), `missing ${action}`);
  }

  const hidden = await prisma.$queryRaw<{ count: number }[]>`SELECT count(*)::int AS count FROM vendors`;
  assert.equal(Number(hidden[0].count), 0);

  await app.close();
});

async function latestInviteToken(tenant: TenantService, email: string) {
  const events = await tenant.unscoped((tx) =>
    tx.outboxEvent.findMany({ where: { type: "email.invitation" }, orderBy: { createdAt: "desc" }, take: 20 }),
  );
  for (const event of events) {
    const payload = JSON.parse(decryptString(event.payloadEnc)) as { text?: string; to?: string };
    if (payload.to !== email) continue;
    const token = payload.text?.match(/invite\/([A-Za-z0-9_-]+)/)?.[1];
    if (token) return token;
  }
  throw new Error(`No invitation token for ${email}`);
}
