import { createCipheriv, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const endpoint = process.env.STORAGE_ENDPOINT || "https://t3.storageapi.dev";
const region = process.env.STORAGE_REGION || "auto";
const bucket = process.env.STORAGE_BUCKET || "";
const accessKey = process.env.STORAGE_ACCESS_KEY || "";
const secret = process.env.STORAGE_SECRET || "";
const pathStyle = String(process.env.STORAGE_PATH_STYLE || "true").toLowerCase() !== "false";

if (!bucket || !accessKey || !secret) {
  console.error("Missing STORAGE_BUCKET, STORAGE_ACCESS_KEY, or STORAGE_SECRET.");
  process.exit(1);
}

function encryptString(plain) {
  const key = Buffer.from(process.env.APP_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

const prisma = new PrismaClient();
const org = await prisma.organization.findFirst({ select: { id: true, name: true, settings: true } });
if (!org) throw new Error("No organization found.");

const current = org.settings && typeof org.settings === "object" && !Array.isArray(org.settings) ? org.settings : {};
const settings = {
  ...current,
  storageEndpoint: endpoint,
  storageRegion: region,
  storageBucket: bucket,
  storageAccessKey: accessKey,
  storageSecretEnc: encryptString(secret),
  storagePathStyle: pathStyle,
};

await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
await prisma.organization.update({ where: { id: org.id }, data: { settings } });

console.log(
  JSON.stringify(
    {
      ok: true,
      organization: org.name,
      storageEndpoint: endpoint,
      storageRegion: region,
      storageBucket: bucket,
      storageAccessKeySet: true,
      storageSecretSet: true,
      storagePathStyle: pathStyle,
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
