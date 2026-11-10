import { PrismaClient } from "@prisma/client";
import { Algorithm, verify } from "@node-rs/argon2";

const email = (process.env.PROD_ADMIN_EMAIL || "admin@projects7.com").toLowerCase();
const password = process.env.PROD_ADMIN_PASSWORD || "";
if (!password) {
  console.error("Set PROD_ADMIN_PASSWORD.");
  process.exit(1);
}

const prisma = new PrismaClient();
const argon = { algorithm: Algorithm.Argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

async function main() {
  await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  });
  if (!user) throw new Error("Admin user not found.");
  if (!user.passwordHash) throw new Error("Admin has no password.");
  const ok = await verify(user.passwordHash, password, argon);
  console.log(
    JSON.stringify(
      {
        email: user.email,
        status: user.status,
        roles: user.roles.map((item) => item.role.name),
        passwordOk: ok,
        mustChangePassword: user.mustChangePassword,
      },
      null,
      2,
    ),
  );
  if (!ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
