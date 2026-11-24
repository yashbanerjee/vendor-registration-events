import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const ids = [
    "20e024de-aa28-40c0-9ca2-82761b002956",
    "31b45919-444d-4741-8233-c1ae544bb6db",
  ];
  for (const id of ids) {
    const r = await prisma.submissionRevision.findUnique({ where: { id } });
    const s = JSON.stringify(r?.data ?? {});
    const matches = s.match(/.{0,60}[Ee]xhibitor.{0,60}/g) || [];
    console.log("REV", id, matches.slice(0, 10));
  }
  // Document Submission form
  const templates = await prisma.formTemplate.findMany({
    where: { OR: [{ name: { contains: "Document" } }, { name: { contains: "Sponsor" } }, { name: { contains: "registration" } }] },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  for (const t of templates) {
    const s = JSON.stringify(t.versions[0]?.schema ?? {});
    if (/exhibitor/i.test(s)) {
      console.log("TEMPLATE HIT", t.name);
      console.log((s.match(/.{0,80}[Ee]xhibitor.{0,80}/g) || []).slice(0, 20));
    } else {
      console.log("TEMPLATE OK", t.name, "no exhibitor");
    }
  }
  // Search ALL form versions more carefully with unicode
  const all = await prisma.formVersion.findMany({ include: { template: true } });
  for (const v of all) {
    const s = JSON.stringify(v.schema);
    if (/exhibit/i.test(s)) {
      const ms = s.match(/.{0,40}[Ee]xhibit\w*.{0,40}/g) || [];
      console.log("exhibit* in", v.template.name, "v"+v.versionNumber, [...new Set(ms)].slice(0, 15));
    }
  }
}
main().finally(() => prisma.$disconnect());
