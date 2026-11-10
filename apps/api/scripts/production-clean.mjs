import { Algorithm, hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";

const KEEP_FORM_ID = "3266031f-496d-48b4-84f9-f3b2a9943613";
const ADMIN_EMAIL = (process.env.PROD_ADMIN_EMAIL || "admin@projects7.com").toLowerCase();
const ADMIN_PASSWORD = process.env.PROD_ADMIN_PASSWORD || "";
const ADMIN_NAME = process.env.PROD_ADMIN_NAME || "Projects7 Admin";

if (!ADMIN_PASSWORD) {
  console.error("Set PROD_ADMIN_PASSWORD.");
  process.exit(1);
}

const prisma = new PrismaClient();
const argon = { algorithm: Algorithm.Argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

async function bypass() {
  await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
}

async function main() {
  await bypass();
  const keep = await prisma.formTemplate.findUnique({ where: { id: KEEP_FORM_ID } });
  if (!keep) throw new Error(`Keep form ${KEEP_FORM_ID} was not found.`);

  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No organization found.");

  console.log(`Keeping form: ${keep.name}`);
  console.log(`Organization: ${org.name}`);

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;

      // Break revision FKs that block deletes.
      await tx.$executeRaw`UPDATE form_assignments SET approved_revision_id = NULL, approved_by_id = NULL`;
      await tx.$executeRaw`UPDATE submissions SET current_revision_id = NULL`;

      await tx.session.deleteMany({});
      await tx.mfaChallenge.deleteMany({}).catch(() => undefined);
      await tx.mfaSecret.deleteMany({}).catch(() => undefined);
      await tx.notification.deleteMany({});
      await tx.emailDeliveryEvent.deleteMany({}).catch(() => undefined);
      await tx.emailMessage.deleteMany({});
      await tx.outboxEvent.deleteMany({});
      await tx.invitation.deleteMany({});
      await tx.correctionRequestField.deleteMany({});
      await tx.correctionRequest.deleteMany({});
      await tx.reviewNote.deleteMany({});
      await tx.submissionRevision.deleteMany({});
      await tx.submission.deleteMany({});
      await tx.documentVersion.deleteMany({});
      await tx.document.deleteMany({});
      await tx.formAssignment.deleteMany({});
      await tx.exhibitionFormFile.deleteMany({}).catch(() => undefined);
      await tx.exhibitionFormReturn.deleteMany({}).catch(() => undefined);
      await tx.exhibitionForm.deleteMany({}).catch(() => undefined);
      await tx.vendorCategoryLink.deleteMany({});
      await tx.vendorExhibition.deleteMany({});
      await tx.importJobRow.deleteMany({});
      await tx.importJob.deleteMany({});
      await tx.vendor.deleteMany({});
      await tx.exhibition.deleteMany({});
      await tx.vendorCategory.deleteMany({});

      // Remove every form except the kept one.
      const otherForms = await tx.formTemplate.findMany({
        where: { id: { not: KEEP_FORM_ID } },
        select: { id: true },
      });
      const otherIds = otherForms.map((form) => form.id);
      if (otherIds.length) {
        await tx.formAsset.deleteMany({ where: { templateId: { in: otherIds } } });
        await tx.formVersion.deleteMany({ where: { templateId: { in: otherIds } } });
        await tx.formTemplate.deleteMany({ where: { id: { in: otherIds } } });
      }

      // Ensure kept form is live.
      await tx.formTemplate.update({
        where: { id: KEEP_FORM_ID },
        data: { archivedAt: null, status: "PUBLISHED" },
      });

      const adminRole = await tx.role.findUniqueOrThrow({ where: { name: "ORG_ADMIN" } });
      const passwordHash = await hash(ADMIN_PASSWORD, argon);

      // Remove all current users, then create the production admin.
      await tx.userRole.deleteMany({});
      await tx.user.deleteMany({});

      const admin = await tx.user.create({
        data: {
          organizationId: org.id,
          email: ADMIN_EMAIL,
          name: ADMIN_NAME,
          status: "ACTIVE",
          passwordHash,
          mustChangePassword: false,
        },
      });
      await tx.userRole.create({
        data: { userId: admin.id, roleId: adminRole.id },
      });

      // Point the kept form creator at the new admin when possible.
      await tx.formTemplate.update({
        where: { id: KEEP_FORM_ID },
        data: { createdById: admin.id },
      });
    },
    { maxWait: 30_000, timeout: 180_000 },
  );

  await bypass();
  const summary = {
    admin: ADMIN_EMAIL,
    form: await prisma.formTemplate.findMany({
      select: { id: true, name: true, status: true, archivedAt: true, _count: { select: { versions: true } } },
    }),
    counts: {
      users: await prisma.user.count(),
      vendors: await prisma.vendor.count(),
      exhibitions: await prisma.exhibition.count(),
      assignments: await prisma.formAssignment.count(),
      documents: await prisma.document.count(),
      forms: await prisma.formTemplate.count(),
      sessions: await prisma.session.count(),
      invitations: await prisma.invitation.count(),
    },
  };
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
