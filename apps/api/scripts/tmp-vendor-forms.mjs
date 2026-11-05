import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rows = await prisma.user.findMany({
  where: { vendorId: { not: null }, status: "ACTIVE" },
  select: {
    email: true,
    vendor: {
      select: {
        companyName: true,
        archivedAt: true,
        assignments: {
          select: {
            status: true,
            formVersion: { select: { template: { select: { name: true, archivedAt: true } } } },
            submission: { select: { revisions: { orderBy: { revisionNumber: "desc" }, take: 1, select: { data: true } } } },
          },
        },
      },
    },
  },
});
const summary = rows
  .filter((row) => row.vendor && !row.vendor.archivedAt)
  .map((row) => ({
    email: row.email,
    company: row.vendor.companyName,
    forms: row.vendor.assignments
      .filter((item) => !item.formVersion.template.archivedAt)
      .map((item) => {
        const data = item.submission?.revisions[0]?.data;
        const uploaded = data && typeof data === "object"
          ? Object.values(data).some((value) => JSON.stringify(value).includes("documentId"))
          : false;
        return { name: item.formVersion.template.name, status: item.status, uploaded };
      }),
  }))
  .filter((row) => row.forms.length);
console.log(JSON.stringify(summary, null, 2));
await prisma.$disconnect();
