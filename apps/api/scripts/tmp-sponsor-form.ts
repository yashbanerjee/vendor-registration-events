import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const template = await prisma.formTemplate.findFirst({
    where: { name: "Sponsor registration" },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  const schema = template?.versions[0]?.schema as any;
  console.log("sections", schema?.sections?.map((s:any)=>s.title));
  for (const f of [...(schema?.fields||[])].sort((a:any,b:any)=>a.order-b.order)) {
    console.log(`${f.required?"*":" "} [${f.type}] ${f.label} key=${f.key}`);
    if (f.description) console.log("   ", f.description.slice(0,200));
  }
}
main().finally(() => prisma.$disconnect());
