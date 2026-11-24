import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const versions = await prisma.formVersion.findMany({
    select: { id: true, versionNumber: true, schema: true, template: { select: { name: true } } },
  });
  for (const v of versions) {
    const s = JSON.stringify(v.schema);
    if (!/exhibitor/i.test(s)) continue;
    console.log("FORM", v.template.name, "v" + v.versionNumber, v.id);
    const matches = s.match(/.{0,80}[Ee]xhibitor.{0,80}/g) || [];
    for (const m of matches.slice(0, 40)) console.log(" -", m.replace(/\s+/g, " "));
  }
}
main().finally(() => prisma.$disconnect());
