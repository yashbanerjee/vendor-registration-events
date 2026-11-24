import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;

  const orgs = await prisma.organization.findMany({
    where: {
      OR: [
        { name: { contains: "Vehda", mode: "insensitive" } },
        { slug: { contains: "vehda", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true },
  });

  const updatedOrgs = [];
  for (const org of orgs) {
    const name = org.name.replace(/Vehda/gi, (match) => (match === match.toUpperCase() ? "VEDHA" : match[0] === "V" ? "Vedha" : "vedha"));
    const next = await prisma.organization.update({
      where: { id: org.id },
      data: { name },
      select: { id: true, name: true, slug: true },
    });
    updatedOrgs.push({ from: org.name, to: next.name, slug: next.slug });
  }

  const exhibitions = await prisma.exhibition.findMany({
    where: {
      OR: [
        { name: { contains: "Vehda", mode: "insensitive" } },
        { venue: { contains: "Vehda", mode: "insensitive" } },
        { code: { contains: "VEHDA", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, venue: true, code: true },
  });

  const updatedExhibitions = [];
  for (const exhibition of exhibitions) {
    const next = await prisma.exhibition.update({
      where: { id: exhibition.id },
      data: {
        name: exhibition.name.replace(/Vehda/gi, "Vedha"),
        venue: exhibition.venue?.replace(/Vehda/gi, "Vedha") ?? exhibition.venue,
        code: exhibition.code.replace(/VEHDA/gi, "VEDHA").replace(/Vehda/gi, "Vedha"),
      },
      select: { id: true, name: true, venue: true, code: true },
    });
    updatedExhibitions.push({
      from: exhibition.name,
      to: next.name,
      venue: next.venue,
      code: next.code,
    });
  }

  const users = await prisma.user.findMany({
    where: { name: { contains: "Vehda", mode: "insensitive" } },
    select: { id: true, name: true },
  });
  const updatedUsers = [];
  for (const user of users) {
    const next = await prisma.user.update({
      where: { id: user.id },
      data: { name: user.name.replace(/Vehda/gi, "Vedha") },
      select: { id: true, name: true },
    });
    updatedUsers.push({ from: user.name, to: next.name });
  }

  console.log(JSON.stringify({ updatedOrgs, updatedExhibitions, updatedUsers }, null, 2));
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
