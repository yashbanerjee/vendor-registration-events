import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true, slug: true } });
  const users = await prisma.user.findMany({
    select: { email: true, name: true, status: true, vendorId: true, organizationId: true },
    orderBy: { email: "asc" },
  });
  const forms = await prisma.formTemplate.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      archivedAt: true,
      organizationId: true,
      updatedAt: true,
      _count: { select: { versions: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const counts = {
    vendors: await prisma.vendor.count(),
    exhibitions: await prisma.exhibition.count(),
    assignments: await prisma.formAssignment.count(),
    documents: await prisma.document.count(),
    importJobs: await prisma.importJob.count(),
    notifications: await prisma.notification.count(),
    sessions: await prisma.session.count(),
    invitations: await prisma.invitation.count(),
    pdfForms: await prisma.exhibitionForm.count(),
    categories: await prisma.vendorCategory.count(),
  };
  console.log(
    JSON.stringify(
      {
        orgs,
        users: users.map((u) => ({
          email: u.email,
          name: u.name,
          status: u.status,
          vendor: Boolean(u.vendorId),
        })),
        forms: forms.map((f) => ({
          id: f.id,
          name: f.name,
          status: f.status,
          archived: Boolean(f.archivedAt),
          versions: f._count.versions,
          updatedAt: f.updatedAt,
        })),
        counts,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
