import { PrismaClient } from "@prisma/client";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
const prisma = new PrismaClient();
async function main() {
  // Print full declaration
  const template = await prisma.formTemplate.findFirst({
    where: { name: "Mandatory design documents", archivedAt: null },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  const schema = template?.versions[0]?.schema as any;
  const decl = schema?.fields?.find((f:any)=>f.key==="declaration");
  console.log("---DECLARATION---");
  console.log(decl?.description || "missing");
  console.log("---END---");
  // search all form assets metadata
  const assets = await prisma.formAsset.findMany({ select: { id: true, filename: true, title: true } as any }).catch(async () => {
    return prisma.formAsset.findMany();
  });
  for (const a of assets as any[]) {
    const blob = JSON.stringify(a);
    if (/exhibitor/i.test(blob)) console.log("ASSET META", a);
  }
  // scan local asset folders
  for (const dir of ["assets", "scripts", "prisma"]) {
    if (!existsSync(dir)) continue;
  }
}
main().finally(() => prisma.$disconnect());
