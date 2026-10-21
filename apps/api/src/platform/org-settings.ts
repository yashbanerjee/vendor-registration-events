import { Prisma } from "@prisma/client";
import { z } from "zod";
import { decryptString, encryptString } from "../common/crypto";
import { env } from "../config/env";

const storedSchema = z.object({
  sessionTtlHours: z.number().optional(),
  invitationTtlHours: z.number().optional(),
  maxUploadMb: z.number().optional(),
  importMaxRows: z.number().optional(),
  emailFromName: z.string().optional(),
  emailFromAddress: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().optional(),
  smtpPasswordEnc: z.string().optional(),
  storageEndpoint: z.string().optional(),
  storageRegion: z.string().optional(),
  storageBucket: z.string().optional(),
  storageAccessKey: z.string().optional(),
  storageSecretEnc: z.string().optional(),
  storagePathStyle: z.boolean().optional(),
});

export type StoredSettings = z.infer<typeof storedSchema>;

export const settingsBody = z.object({
  name: z.string().trim().min(2).max(200),
  sessionTtlHours: z.coerce.number().min(1).max(24 * 14),
  invitationTtlHours: z.coerce.number().min(1).max(24 * 30),
  maxUploadMb: z.coerce.number().int().min(1).max(100),
  importMaxRows: z.coerce.number().int().min(1).max(50_000),
  emailFromName: z.string().trim().min(1).max(120),
  emailFromAddress: z.string().trim().email(),
  smtpHost: z.string().trim().max(255).default(""),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  smtpUser: z.string().trim().max(255).default(""),
  smtpPassword: z.string().max(200).optional().default(""),
  clearSmtpPassword: z.boolean().optional().default(false),
  storageEndpoint: z.string().trim().max(300).default(""),
  storageRegion: z.string().trim().max(64).default(""),
  storageBucket: z.string().trim().max(200).default(""),
  storageAccessKey: z.string().trim().max(200).default(""),
  storageSecret: z.string().max(500).optional().default(""),
  clearStorageSecret: z.boolean().optional().default(false),
  storagePathStyle: z.boolean().default(false),
});

export function parseStored(value: Prisma.JsonValue | null | undefined): StoredSettings {
  const parsed = storedSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function railwayStorageEnv() {
  const endpoint = process.env.ENDPOINT || process.env.AWS_ENDPOINT_URL || process.env.S3_ENDPOINT || "";
  const bucket = process.env.BUCKET || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET || "";
  const accessKey = process.env.ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || "";
  const secret = process.env.SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || "";
  const region = process.env.REGION || process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || process.env.S3_REGION || (endpoint ? "auto" : "");
  const style = (process.env.AWS_S3_URL_STYLE || "").toLowerCase();
  const pathStyle = style === "path" || process.env.S3_FORCE_PATH_STYLE === "true";
  return { endpoint, bucket, accessKey, secret, region, pathStyle };
}

function defaultFrom() {
  const match = env().SMTP_FROM.match(/^(.*?)\s*<([^>]+)>\s*$/);
  return {
    name: match?.[1]?.trim() || "s7",
    address: match?.[2]?.trim() || "noreply@localhost",
  };
}

export function effectiveSettings(stored: StoredSettings) {
  const config = env();
  const from = defaultFrom();
  const emailFromName = stored.emailFromName || from.name;
  const emailFromAddress = stored.emailFromAddress || from.address;
  let smtpPassword = config.SMTP_PASS;
  if (stored.smtpPasswordEnc) {
    try {
      smtpPassword = decryptString(stored.smtpPasswordEnc);
    } catch {
      smtpPassword = config.SMTP_PASS;
    }
  }
  const maxUploadMb = stored.maxUploadMb ?? Math.max(1, Math.round(config.MAX_UPLOAD_BYTES / (1024 * 1024)));
  const railway = railwayStorageEnv();
  let storageSecret = railway.secret || config.S3_SECRET_KEY || "";
  if (stored.storageSecretEnc) {
    try {
      storageSecret = decryptString(stored.storageSecretEnc);
    } catch {
      storageSecret = railway.secret || config.S3_SECRET_KEY || "";
    }
  }
  return {
    sessionTtlHours: stored.sessionTtlHours ?? config.SESSION_TTL_HOURS,
    invitationTtlHours: stored.invitationTtlHours ?? config.INVITATION_TTL_HOURS,
    maxUploadMb,
    maxUploadBytes: maxUploadMb * 1024 * 1024,
    importMaxRows: stored.importMaxRows ?? config.IMPORT_MAX_ROWS,
    emailFromName,
    emailFromAddress,
    emailFrom: `${emailFromName} <${emailFromAddress}>`,
    smtpHost: stored.smtpHost || config.SMTP_HOST,
    smtpPort: stored.smtpPort ?? config.SMTP_PORT,
    smtpSecure: stored.smtpSecure ?? config.SMTP_SECURE,
    smtpUser: stored.smtpUser || config.SMTP_USER,
    smtpPassword,
    smtpPasswordSet: Boolean(stored.smtpPasswordEnc),
    storageEndpoint: stored.storageEndpoint || railway.endpoint || "",
    storageRegion: stored.storageRegion || railway.region || "",
    storageBucket: stored.storageBucket || railway.bucket || "",
    storageAccessKey: stored.storageAccessKey || railway.accessKey || "",
    storageSecret,
    storageSecretSet: Boolean(stored.storageSecretEnc),
    storagePathStyle: stored.storagePathStyle ?? (railway.endpoint ? railway.pathStyle : false),
  };
}

export function publicSettings(stored: StoredSettings) {
  const settings = effectiveSettings(stored);
  return {
    sessionTtlHours: settings.sessionTtlHours,
    invitationTtlHours: settings.invitationTtlHours,
    maxUploadMb: settings.maxUploadMb,
    importMaxRows: settings.importMaxRows,
    emailFromName: settings.emailFromName,
    emailFromAddress: settings.emailFromAddress,
    smtpHost: stored.smtpHost ?? "",
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    smtpUser: stored.smtpUser ?? "",
    smtpPasswordSet: settings.smtpPasswordSet,
    storageEndpoint: settings.storageEndpoint,
    storageRegion: settings.storageRegion,
    storageBucket: settings.storageBucket,
    storageAccessKey: settings.storageAccessKey,
    storagePathStyle: settings.storagePathStyle,
    storageSecretSet: settings.storageSecretSet,
  };
}

export function nextStored(current: StoredSettings, input: z.infer<typeof settingsBody>): Prisma.InputJsonValue {
  let smtpPasswordEnc = current.smtpPasswordEnc ?? "";
  if (input.clearSmtpPassword) smtpPasswordEnc = "";
  else if (input.smtpPassword) smtpPasswordEnc = encryptString(input.smtpPassword);
  const railway = railwayStorageEnv();
  let storageSecretEnc = current.storageSecretEnc ?? "";
  if (input.clearStorageSecret) storageSecretEnc = "";
  else if (input.storageSecret) storageSecretEnc = encryptString(input.storageSecret);
  else if (!storageSecretEnc && railway.secret) storageSecretEnc = encryptString(railway.secret);
  return {
    sessionTtlHours: input.sessionTtlHours,
    invitationTtlHours: input.invitationTtlHours,
    maxUploadMb: input.maxUploadMb,
    importMaxRows: input.importMaxRows,
    emailFromName: input.emailFromName,
    emailFromAddress: input.emailFromAddress,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpSecure: input.smtpSecure,
    smtpUser: input.smtpUser,
    smtpPasswordEnc,
    storageEndpoint: input.storageEndpoint || railway.endpoint,
    storageRegion: input.storageRegion || railway.region || (input.storageEndpoint || railway.endpoint ? "auto" : ""),
    storageBucket: input.storageBucket || railway.bucket,
    storageAccessKey: input.storageAccessKey || railway.accessKey,
    storageSecretEnc,
    storagePathStyle: input.storagePathStyle,
  };
}
