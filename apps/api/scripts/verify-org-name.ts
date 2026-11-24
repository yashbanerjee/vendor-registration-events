import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
  const orgs = await prisma.organization.findMany({ select: { name: true, slug: true, settings: true } });
  console.log(
    JSON.stringify(
      orgs.map((org) => {
        const settings = (org.settings ?? {}) as Record<string, unknown>;
        return {
          name: org.name,
          slug: org.slug,
          fromName: settings.fromName ?? null,
        };
      }),
      null,
      2,
    ),
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
