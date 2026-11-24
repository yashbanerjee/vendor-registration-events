import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  // Check form asset binary filenames and any stored text fields
  const assets = await prisma.formAsset.findMany();
  console.log("assets", assets.length);
  for (const a of assets) {
    const keys = Object.keys(a);
    console.log(a.id, (a as any).filename || (a as any).originalName || keys.join(","));
  }
  // Search submission revision data for exhibitor strings (unlikely)
  const revs = await prisma.submissionRevision.findMany({ take: 50, orderBy: { createdAt: "desc" } });
  let hits = 0;
  for (const r of revs) {
    if (/exhibitor/i.test(JSON.stringify(r.data))) {
      hits++;
      console.log("rev hit", r.id);
    }
  }
  console.log("revision hits", hits);
  // All form template names
  const templates = await prisma.formTemplate.findMany({ select: { name: true } });
  console.log("templates", templates.map(t => t.name));
}
main().finally(() => prisma.$disconnect());
