import { PrismaClient } from "@prisma/client";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

async function main() {
  // Find storage config from env
  const env = process.env;
  console.log("S3?", Boolean(env.S3_BUCKET || env.AWS_S3_BUCKET || env.STORAGE_BUCKET));
  const keys = Object.keys(env).filter(k => /S3|BUCKET|STORAGE|MINIO|R2/i.test(k));
  console.log("env keys", keys);

  const asset = await prisma.formAsset.findFirst({ where: { filename: "letter-of-undertaking _1_.pdf" } });
  console.log("sample asset", asset?.id, asset?.sizeBytes, asset?.storageKey);

  // Try reading via documents service storage if local
  const { env: appEnv } = await import("../src/config/env.js").catch(()=>({env:()=>({})}));
  try {
    const e = typeof appEnv === "function" ? appEnv() : {};
    console.log("app storage", { bucket: e.S3_BUCKET, endpoint: e.S3_ENDPOINT, region: e.S3_REGION });
  } catch (err) {
    console.log("env load fail", err);
  }
}
main().finally(() => prisma.$disconnect());
