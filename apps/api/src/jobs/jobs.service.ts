import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import nodemailer from "nodemailer";
import { env } from "../config/env";
import { decryptString, encryptString } from "../common/crypto";
import { AuditService } from "../audit/audit.service";
import { scanBuffer } from "../documents/scan";
import { effectiveSettings, parseStored } from "../platform/org-settings";
import { TenantService, type Tx } from "../prisma/prisma.service";
import { publicActionUrl, renderEmail, type EmailAudience } from "./email-templates";
import { StorageService } from "../storage/storage.service";

export type OutboxPayload = Record<string, unknown>;

@Injectable()
export class OutboxService {
  constructor(@Inject(TenantService) private readonly tenant: TenantService) {}

  async enqueue(tx: Tx, input: { organizationId: string; type: string; idempotencyKey: string; payload: OutboxPayload }) {
    const existing = await tx.outboxEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
    return tx.outboxEvent.create({
      data: {
        organizationId: input.organizationId,
        type: input.type,
        idempotencyKey: input.idempotencyKey,
        payloadEnc: encryptString(JSON.stringify(input.payload)),
      },
    });
  }
}

type Claimed = {
  id: string;
  organizationId: string;
  type: string;
  payloadEnc: string;
  attempts: number;
  idempotencyKey: string;
};

@Injectable()
export class OutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessor.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private connection: IORedis | null = null;
  private workerConnection: IORedis | null = null;

  constructor(
    @Inject(TenantService) private readonly tenant: TenantService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    const config = env();
    const relay = (config.PROCESS_ROLE === "worker" && config.JOBS_MODE === "queue") || (config.PROCESS_ROLE === "api" && config.JOBS_MODE === "inline");
    if (!relay) return;
    if (config.JOBS_MODE === "queue") {
      this.connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
      this.queue = new Queue("portal-outbox", { connection: this.connection });
      if (config.PROCESS_ROLE === "worker") {
        this.workerConnection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
        this.worker = new Worker("portal-outbox", async (job) => this.handleById(String(job.data.id)), {
          connection: this.workerConnection,
          concurrency: 4,
        });
      }
    }
    this.timer = setInterval(() => void this.flush(), 1000);
    this.timer.unref?.();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
    await this.workerConnection?.quit();
  }

  async flush(limit = 25) {
    if (this.running) return;
    this.running = true;
    try {
      for (let index = 0; index < limit; index += 1) {
        const claimed = await this.claim();
        if (!claimed) break;
        if (env().JOBS_MODE === "queue" && this.queue) {
          await this.queue.add("dispatch", { id: claimed.id }, {
            jobId: claimed.id,
            attempts: 8,
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: 1000,
            removeOnFail: 1000,
          });
        } else {
          await this.dispatchClaim(claimed);
        }
      }
    } finally {
      this.running = false;
    }
  }

  async retry(organizationId: string, id: string) {
    const updated = await this.tenant.transaction(organizationId, async (tx) => {
      const event = await tx.outboxEvent.findFirst({ where: { id, organizationId, status: "FAILED" } });
      if (!event) return null;
      return tx.outboxEvent.update({
        where: { id },
        data: { status: "PENDING", attempts: 0, availableAt: new Date(), lastError: "" },
      });
    });
    if (!updated) return null;
    await this.flush(10);
    return updated;
  }

  private async claim(): Promise<Claimed | null> {
    return this.tenant.unscoped(async (tx) => {
      const rows = await tx.$queryRaw<Claimed[]>`
        UPDATE outbox_events
        SET status = 'PROCESSING'
        WHERE id = (
          SELECT id FROM outbox_events
          WHERE status = 'PENDING' AND available_at <= NOW()
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING id, organization_id AS "organizationId", type, payload_enc AS "payloadEnc", attempts, idempotency_key AS "idempotencyKey"
      `;
      return rows[0] ?? null;
    });
  }

  private async handleById(id: string) {
    const event = await this.tenant.unscoped((tx) => tx.outboxEvent.findUnique({ where: { id } }));
    if (!event || event.status === "PUBLISHED") return;
    await this.dispatchClaim({
      id: event.id,
      organizationId: event.organizationId,
      type: event.type,
      payloadEnc: event.payloadEnc,
      attempts: event.attempts,
      idempotencyKey: event.idempotencyKey,
    });
  }

  private async dispatchClaim(claimed: Claimed) {
    try {
      const payload = JSON.parse(decryptString(claimed.payloadEnc)) as OutboxPayload;
      if (claimed.type.startsWith("email.")) await this.sendEmail(claimed.organizationId, payload);
      else if (claimed.type === "document.scan") await this.scanDocument(claimed.organizationId, payload);
      else throw new Error(`Unknown outbox type ${claimed.type}`);
      await this.tenant.unscoped((tx) =>
        tx.outboxEvent.update({
          where: { id: claimed.id },
          data: { status: "PUBLISHED", publishedAt: new Date(), lastError: "" },
        }),
      );
    } catch (error) {
      const attempts = claimed.attempts + 1;
      const exhausted = attempts >= 8;
      const delay = Math.min(60_000 * 2 ** attempts, 15 * 60_000);
      const message = error instanceof Error ? error.message.slice(0, 500) : "Background job failed.";
      this.logger.warn(`Outbox ${claimed.type} failed: ${message}`);
      await this.tenant.unscoped((tx) =>
        tx.outboxEvent.update({
          where: { id: claimed.id },
          data: {
            status: exhausted ? "FAILED" : "PENDING",
            attempts,
            availableAt: new Date(Date.now() + delay),
            lastError: message,
          },
        }),
      );
      if (env().JOBS_MODE === "queue") throw error;
    }
  }

  private async sendEmail(organizationId: string, payload: OutboxPayload) {
    const to = String(payload.to ?? "");
    const subject = String(payload.subject ?? "");
    const text = String(payload.text ?? "");
    const template = String(payload.template ?? "generic");
    const idempotencyKey = String(payload.idempotencyKey ?? "");
    const userId = typeof payload.userId === "string" ? payload.userId : null;
    if (!to || !idempotencyKey) throw new Error("Email payload is incomplete.");

    const existing = await this.tenant.transaction(organizationId, async (tx) => {
      const found = await tx.emailMessage.findUnique({ where: { idempotencyKey } });
      if (found && (found.status === "SENT" || found.status === "DELIVERED")) return found;
      if (found) return found;
      const created = await tx.emailMessage.create({
        data: {
          organizationId,
          toAddress: to,
          template,
          subject,
          status: "QUEUED",
          idempotencyKey,
        },
      });
      if (userId) {
        await tx.notification.create({
          data: {
            organizationId,
            userId,
            title: String(payload.title ?? subject),
            body: text.slice(0, 500),
            link: String(payload.link ?? ""),
          },
        });
      }
      return created;
    });
    if (existing.status === "SENT" || existing.status === "DELIVERED") return;

    const organization = await this.tenant.transaction(organizationId, (tx) =>
      tx.organization.findUnique({ where: { id: organizationId }, select: { name: true, settings: true } }),
    );
    const mail = effectiveSettings(parseStored(organization?.settings));
    const actionUrl = publicActionUrl({
      link: String(payload.actionUrl ?? payload.link ?? ""),
      text: text,
      origin: env().WEB_ORIGIN,
    });
    const audience: EmailAudience = payload.audience === "admin" ? "admin" : "vendor";
    const rendered = renderEmail({
      template,
      audience,
      organizationName: organization?.name ?? "s7",
      title: String(payload.title ?? subject),
      body: text,
      actionUrl,
    });
    const transport = mail.smtpHost === "json"
      ? nodemailer.createTransport({ jsonTransport: true })
      : nodemailer.createTransport({
          host: mail.smtpHost,
          port: mail.smtpPort,
          secure: mail.smtpSecure,
          auth: mail.smtpUser ? { user: mail.smtpUser, pass: mail.smtpPassword } : undefined,
        });
    try {
      const info = await transport.sendMail({
        from: mail.emailFrom,
        to,
        subject,
        text: rendered.text,
        html: rendered.html,
        headers: { "X-Idempotency-Key": idempotencyKey },
      });
      await this.tenant.transaction(organizationId, async (tx) => {
        await tx.emailMessage.update({
          where: { id: existing.id },
          data: {
            status: "SENT",
            providerMessageId: info.messageId ?? null,
            attemptCount: { increment: 1 },
            lastError: "",
          },
        });
        await tx.emailDeliveryEvent.create({
          data: {
            organizationId,
            emailMessageId: existing.id,
            status: "SENT",
            source: "smtp_accepted",
            payload: { accepted: true },
          },
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "SMTP send failed.";
      await this.tenant.transaction(organizationId, async (tx) => {
        await tx.emailMessage.update({
          where: { id: existing.id },
          data: { status: "FAILED", attemptCount: { increment: 1 }, lastError: message },
        });
        await tx.emailDeliveryEvent.create({
          data: {
            organizationId,
            emailMessageId: existing.id,
            status: "FAILED",
            source: "smtp_error",
            payload: { message },
          },
        });
      });
      throw error;
    }
  }

  private async scanDocument(organizationId: string, payload: OutboxPayload) {
    const documentId = String(payload.documentId ?? "");
    const versionId = String(payload.versionId ?? "");
    const record = await this.tenant.transaction(organizationId, async (tx) => {
      const version = await tx.documentVersion.findFirst({
        where: { id: versionId, organizationId, documentId },
        include: { document: true },
      });
      return version;
    });
    if (!record) throw new Error("Document version was not found.");
    if (record.document.status === "AVAILABLE" || record.document.status === "REJECTED") return;
    const bytes = await this.storage.get(organizationId, record.storageKey);
    const config = env();
    const result = await scanBuffer(bytes, record.filename, record.mimeType, {
      host: config.CLAMAV_HOST,
      port: config.CLAMAV_PORT,
    });
    await this.tenant.transaction(organizationId, async (tx) => {
      await tx.documentVersion.update({
        where: { id: versionId },
        data: { scanStatus: result.clean ? "clean" : "rejected", scanDetails: result.details },
      });
      await tx.document.update({
        where: { id: documentId },
        data: { status: result.clean ? "AVAILABLE" : "REJECTED" },
      });
      await this.audit.record(tx, {
        organizationId,
        action: result.clean ? "document.scanned" : "document.rejected",
        resourceType: "document",
        resourceId: documentId,
        vendorId: record.document.vendorId,
        newValue: { scanStatus: result.clean ? "clean" : "rejected" },
      });
    });
  }
}
