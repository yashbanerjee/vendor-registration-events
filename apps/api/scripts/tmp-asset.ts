import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const asset = await prisma.formAsset.findFirst({ where: { filename: { contains: "letter-of-undertaking", mode: "insensitive" } } });
  console.log(asset);
}
main().finally(() => prisma.$disconnect());
