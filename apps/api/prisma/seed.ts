import { Algorithm, hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from "@vmp/shared";

const prisma = new PrismaClient();
const argon = { algorithm: Algorithm.Argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed production.");
  }
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@harbor.example").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Admin1";
  const reviewerEmail = (process.env.SEED_REVIEWER_EMAIL ?? "reviewer@harbor.example").toLowerCase();
  const reviewerPassword = process.env.SEED_REVIEWER_PASSWORD ?? "ChangeMe!Review1";

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    const organization = await tx.organization.upsert({
      where: { slug: "harbor" },
      update: { name: "Harbor Exhibitions" },
      create: { name: "Harbor Exhibitions", slug: "harbor" },
    });
    const permissions = new Map<string, string>();
    for (const key of ALL_PERMISSIONS) {
      const permission = await tx.permission.upsert({ where: { key }, update: {}, create: { key } });
      permissions.set(key, permission.id);
    }
    for (const [roleName, keys] of Object.entries(ROLE_PERMISSIONS)) {
      const role = await tx.role.upsert({ where: { name: roleName }, update: {}, create: { name: roleName } });
      for (const key of keys) {
        const permissionId = permissions.get(key);
        if (!permissionId) continue;
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId } },
          update: {},
          create: { roleId: role.id, permissionId },
        });
      }
    }
    const adminRole = await tx.role.findUniqueOrThrow({ where: { name: "ORG_ADMIN" } });
    const reviewerRole = await tx.role.findUniqueOrThrow({ where: { name: "REVIEWER" } });
    const admin = await tx.user.upsert({
      where: { email: adminEmail },
      update: { name: "Harbor Admin", status: "ACTIVE", passwordHash: await hash(adminPassword, argon) },
      create: {
        organizationId: organization.id,
        email: adminEmail,
        name: "Harbor Admin",
        status: "ACTIVE",
        passwordHash: await hash(adminPassword, argon),
      },
    });
    const reviewer = await tx.user.upsert({
      where: { email: reviewerEmail },
      update: { name: "Harbor Reviewer", status: "ACTIVE", passwordHash: await hash(reviewerPassword, argon) },
      create: {
        organizationId: organization.id,
        email: reviewerEmail,
        name: "Harbor Reviewer",
        status: "ACTIVE",
        passwordHash: await hash(reviewerPassword, argon),
      },
    });
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: reviewer.id, roleId: reviewerRole.id } },
      update: {},
      create: { userId: reviewer.id, roleId: reviewerRole.id },
    });
    await tx.exhibition.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: "HL-2026" } },
      update: {},
      create: {
        organizationId: organization.id,
        name: "Harbor Lights 2026",
        code: "HL-2026",
        venue: "Pier 4 Hall",
        description: "Annual harbor trade exhibition.",
        startsAt: new Date("2026-11-12T09:00:00.000Z"),
        endsAt: new Date("2026-11-15T18:00:00.000Z"),
        status: "PUBLISHED",
      },
    });
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
