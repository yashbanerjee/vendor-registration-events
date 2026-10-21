import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  PROCESS_ROLE: z.enum(["api", "worker"]).default("api"),
  DATABASE_URL: z.string().min(1),
  MIGRATE_DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JOBS_MODE: z.enum(["inline", "queue"]).default("inline"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  APP_ENCRYPTION_KEY: z.string().min(1),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
  INVITATION_TTL_HOURS: z.coerce.number().positive().default(72),
  STORAGE_DRIVER: z.enum(["s3", "local"]).default("s3"),
  STORAGE_LOCAL_DIR: z.string().default("storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("vendor-documents"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(20_971_520),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().default("s7 <noreply@harbor.example>"),
  SMTP_FALLBACK_HOST: z.string().optional().default(""),
  SMTP_FALLBACK_PORT: z.coerce.number().int().positive().default(587),
  SMTP_FALLBACK_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_FALLBACK_USER: z.string().optional().default(""),
  SMTP_FALLBACK_PASS: z.string().optional().default(""),
  SMTP_FALLBACK_FROM: z.string().optional().default(""),
  EMAIL_WEBHOOK_SECRET: z.string().default(""),
  CLAMAV_HOST: z.string().optional().default(""),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  ENABLE_SWAGGER: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  IMPORT_MAX_ROWS: z.coerce.number().int().positive().default(5000),
  IMPORT_MAX_BYTES: z.coerce.number().int().positive().default(5_242_880),
});

export type AppEnv = z.infer<typeof schema>;

let cached: AppEnv | undefined;

export function env(): AppEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment: ${message}`);
  }
  if (parsed.data.NODE_ENV === "production") {
    if (parsed.data.APP_ENCRYPTION_KEY.includes("MDEyMzQ1Njc4OWFiY2RlZg")) {
      throw new Error("Replace APP_ENCRYPTION_KEY before production use.");
    }
    if (!parsed.data.COOKIE_SECURE) {
      throw new Error("COOKIE_SECURE must be true in production.");
    }
    if (parsed.data.ENABLE_SWAGGER) {
      throw new Error("Disable Swagger in production or expose it only on a private network by setting ENABLE_SWAGGER=false.");
    }
  }
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  let webOrigin = parsed.data.WEB_ORIGIN.trim().replace(/\/$/, "");
  if (railwayDomain && webOrigin.startsWith("http://localhost")) {
    webOrigin = `https://${railwayDomain}`;
  }
  parsed.data.WEB_ORIGIN = webOrigin;
  cached = parsed.data;
  return cached;
}

export function allowedOrigins(): string[] {
  const config = env();
  const origins = new Set<string>([config.WEB_ORIGIN]);
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain) origins.add(`https://${railwayDomain}`);
  origins.add(`http://127.0.0.1:${config.API_PORT}`);
  origins.add(`http://localhost:${config.API_PORT}`);
  return [...origins];
}

export function resetEnvCache() {
  cached = undefined;
}
