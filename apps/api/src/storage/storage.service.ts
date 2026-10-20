import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { env } from "../config/env";
import { encryptString } from "../common/crypto";
import { effectiveSettings, parseStored, railwayStorageEnv } from "../platform/org-settings";
import { TenantService } from "../prisma/prisma.service";

type StorageConfig = ReturnType<typeof effectiveSettings>;

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private clientKey = "";

  constructor(@Inject(TenantService) private readonly tenant: TenantService) {}

  async onModuleInit() {
    const railway = railwayStorageEnv();
    if (!railway.endpoint || !railway.bucket || !railway.accessKey || !railway.secret) return;
    await this.tenant.unscoped(async (tx) => {
      const organizations = await tx.organization.findMany({ select: { id: true, settings: true } });
      for (const organization of organizations) {
        const stored = parseStored(organization.settings);
        if (stored.storageEndpoint && stored.storageBucket && stored.storageSecretEnc) continue;
        const current = organization.settings && typeof organization.settings === "object" && !Array.isArray(organization.settings) ? organization.settings : {};
        await tx.organization.update({
          where: { id: organization.id },
          data: {
            settings: {
              ...current,
              storageEndpoint: stored.storageEndpoint || railway.endpoint,
              storageRegion: stored.storageRegion || railway.region,
              storageBucket: stored.storageBucket || railway.bucket,
              storageAccessKey: stored.storageAccessKey || railway.accessKey,
              storageSecretEnc: stored.storageSecretEnc || encryptString(railway.secret),
              storagePathStyle: stored.storagePathStyle ?? railway.pathStyle,
            } as Prisma.InputJsonValue,
          },
        });
      }
    });
  }

  async put(organizationId: string, key: string, body: Buffer, mimeType: string) {
    this.assertKey(key);
    const config = await this.configFor(organizationId);
    if (this.useLocal(config)) {
      const target = this.localPath(key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, body, { flag: "wx" });
      return;
    }
    this.requireBucket(config);
    await this.s3(config).send(
      new PutObjectCommand({
        Bucket: config.storageBucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        ServerSideEncryption: config.storageEndpoint ? undefined : "AES256",
      }),
    );
  }

  async get(organizationId: string, key: string): Promise<Buffer> {
    this.assertKey(key);
    const config = await this.configFor(organizationId);
    if (this.useLocal(config)) return readFile(this.localPath(key));
    this.requireBucket(config);
    const response = await this.s3(config).send(new GetObjectCommand({ Bucket: config.storageBucket, Key: key }));
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty object.");
    return Buffer.from(bytes);
  }

  async presign(organizationId: string, key: string, ttlSeconds = 60): Promise<string | null> {
    this.assertKey(key);
    const config = await this.configFor(organizationId);
    if (this.useLocal(config)) return null;
    this.requireBucket(config);
    return getSignedUrl(this.s3(config), new GetObjectCommand({ Bucket: config.storageBucket, Key: key }), { expiresIn: ttlSeconds });
  }

  private async configFor(organizationId: string) {
    const organization = await this.tenant.transaction(organizationId, (tx) =>
      tx.organization.findUnique({ where: { id: organizationId }, select: { settings: true } }),
    );
    return effectiveSettings(parseStored(organization?.settings));
  }

  private useLocal(config: StorageConfig) {
    const ready = Boolean(config.storageEndpoint && config.storageBucket && config.storageAccessKey && config.storageSecret);
    if (ready) return false;
    if (env().STORAGE_DRIVER === "local" || env().NODE_ENV !== "production") return true;
    return false;
  }

  private requireBucket(config: StorageConfig) {
    if (!config.storageBucket || !config.storageAccessKey || !config.storageSecret) {
      throw new Error("Railway storage settings are incomplete.");
    }
  }

  private s3(config: StorageConfig): S3Client {
    const key = [config.storageEndpoint, config.storageRegion, config.storageAccessKey, String(config.storagePathStyle)].join("|");
    if (this.client && this.clientKey === key) return this.client;
    this.clientKey = key;
    this.client = new S3Client({
      region: config.storageRegion || "auto",
      endpoint: config.storageEndpoint || undefined,
      forcePathStyle: config.storagePathStyle,
      credentials: { accessKeyId: config.storageAccessKey, secretAccessKey: config.storageSecret },
    });
    return this.client;
  }

  private localPath(key: string) {
    const root = path.resolve(env().STORAGE_LOCAL_DIR);
    const target = path.resolve(root, key);
    const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
    if (target !== root && !target.startsWith(rootWithSep)) throw new Error("Invalid storage key.");
    return target;
  }

  private assertKey(key: string) {
    if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) {
      this.logger.warn("Rejected a storage key.");
      throw new Error("Invalid storage key.");
    }
  }
}
