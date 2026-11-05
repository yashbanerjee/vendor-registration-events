import { writeFileSync } from "node:fs";
import { Algorithm, hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";

const email = "layout-check.vendor@example.com";
const password = `Layout-${crypto.randomUUID()}`;
const prisma = new PrismaClient();
const argon = { algorithm: Algorithm.Argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

async function main() {
  const template = await prisma.formTemplate.findFirst({
    where: { name: "Mandatory design documents", archivedAt: null },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  const version = template?.versions[0];
  if (!template || !version) throw new Error("Form not found");
  const schema = version.schema as { fields?: { id: string; type: string }[] };
  const field = schema.fields?.find((item) => item.type === "reupload" || item.type === "file" || item.type === "files");
  if (!field) throw new Error("No document field");
  const exhibition = await prisma.exhibition.findFirst({ where: { organizationId: template.organizationId } });
  const admin = await prisma.user.findFirst({ where: { organizationId: template.organizationId, vendorId: null, status: "ACTIVE" } });
  const role = await prisma.role.findUnique({ where: { name: "VENDOR" } });
  if (!exhibition || !admin || !role) throw new Error("Missing exhibition, admin, or role");
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, vendorId: true } });
  if (existing) {
    if (existing.vendorId) {
      await prisma.submissionRevision.deleteMany({ where: { submission: { assignment: { vendorId: existing.vendorId } } } });
      await prisma.submission.deleteMany({ where: { assignment: { vendorId: existing.vendorId } } });
      await prisma.formAssignment.deleteMany({ where: { vendorId: existing.vendorId } });
    }
    await prisma.userRole.deleteMany({ where: { userId: existing.id } });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
    if (existing.vendorId) await prisma.vendor.delete({ where: { id: existing.vendorId } });
  }
  const vendor = await prisma.vendor.create({
    data: {
      organizationId: template.organizationId,
      reference: "LAYOUT-CHECK",
      companyName: "Layout check",
      contactName: "Layout check",
      email,
      status: "ACTIVE",
    },
  });
  const user = await prisma.user.create({
    data: {
      organizationId: template.organizationId,
      email,
      name: "Layout check",
      status: "ACTIVE",
      passwordHash: await hash(password, argon),
      vendorId: vendor.id,
      mustChangePassword: false,
    },
  });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  const assignment = await prisma.formAssignment.create({
    data: {
      organizationId: template.organizationId,
      vendorId: vendor.id,
      exhibitionId: exhibition.id,
      formVersionId: version.id,
      status: "IN_PROGRESS",
      createdById: admin.id,
    },
  });
  const submission = await prisma.submission.create({
    data: { organizationId: template.organizationId, assignmentId: assignment.id },
  });
  const revision = await prisma.submissionRevision.create({
    data: {
      organizationId: template.organizationId,
      submissionId: submission.id,
      formVersionId: version.id,
      revisionNumber: 1,
      data: { [field.id]: { documentId: "preview", filename: "sample-upload.pdf" } },
      createdById: user.id,
    },
  });
  await prisma.submission.update({ where: { id: submission.id }, data: { currentRevisionId: revision.id } });
  writeFileSync("scripts/tmp-vendor-pass.txt", password);
  console.log("ready");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "failed");
  process.exit(1);
});
