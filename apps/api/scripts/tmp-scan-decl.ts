import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const template = await prisma.formTemplate.findFirst({
    where: { name: "Mandatory design documents", archivedAt: null },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 2 } },
  });
  if (!template) { console.log("no template"); return; }
  for (const v of template.versions) {
    const schema = v.schema as any;
    console.log("\n===", template.name, "v"+v.versionNumber, "===");
    for (const f of schema.fields || []) {
      const blob = [f.label, f.description, f.placeholder].filter(Boolean).join(" | ");
      if (/declar|undertak|exhibit|sponsor|client/i.test(blob) || f.type === "info") {
        console.log("FIELD", f.key, f.type);
        console.log(" label:", f.label);
        if (f.description) console.log(" desc:", String(f.description).slice(0, 500));
        if (String(f.description||"").length > 500) console.log(" ...len", String(f.description).length);
      }
    }
  }
  // broader scan any form field text with exhibit
  const all = await prisma.formVersion.findMany({ include: { template: true } });
  for (const v of all) {
    const s = JSON.stringify(v.schema);
    for (const word of ["Exhibitor","exhibitor","EXHIBITOR","Exhibitors","exhibitors"]) {
      if (s.includes(word)) console.log("HIT", word, v.template.name, v.versionNumber);
    }
  }
}
main().finally(() => prisma.$disconnect());
