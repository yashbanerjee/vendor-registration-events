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
  const reviewerEmail = process.env.SEED_REVIEWER_EMAIL?.trim().toLowerCase();
  const reviewerPassword = process.env.SEED_REVIEWER_PASSWORD;
  const adminHash = await hash(adminPassword, argon);
  const reviewerHash = reviewerEmail && reviewerPassword ? await hash(reviewerPassword, argon) : null;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    const organization = await tx.organization.upsert({
      where: { slug: "vehda" },
      update: { name: "Vehda" },
      create: { name: "Vehda", slug: "vehda" },
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
      update: { name: "Vehda Admin", status: "ACTIVE", passwordHash: adminHash },
      create: {
        organizationId: organization.id,
        email: adminEmail,
        name: "Vehda Admin",
        status: "ACTIVE",
        passwordHash: adminHash,
      },
    });
    const reviewer = reviewerEmail && reviewerPassword
      ? await tx.user.upsert({
          where: { email: reviewerEmail },
          update: { name: "Reviewer", status: "ACTIVE", passwordHash: reviewerHash ?? undefined },
          create: {
            organizationId: organization.id,
            email: reviewerEmail,
            name: "Reviewer",
            status: "ACTIVE",
            passwordHash: reviewerHash,
          },
        })
      : null;
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });
    if (reviewer) {
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: reviewer.id, roleId: reviewerRole.id } },
        update: {},
        create: { userId: reviewer.id, roleId: reviewerRole.id },
      });
    }
    await tx.exhibition.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: "VEHDA-2026" } },
      update: {},
      create: {
        organizationId: organization.id,
        name: "Vehda Exhibition",
        code: "VEHDA-2026",
        venue: "Vehda",
        description: "Exhibition vendor registration.",
        startsAt: new Date("2026-11-12T09:00:00.000Z"),
        endsAt: new Date("2026-11-15T18:00:00.000Z"),
        status: "PUBLISHED",
      },
    });
  }, { maxWait: 20_000, timeout: 120_000 });
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
