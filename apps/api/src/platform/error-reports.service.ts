import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { AuthContext } from "../common/auth";
import { currentContext } from "../common/context";
import { OutboxService } from "../jobs/jobs.service";
import { TenantService } from "../prisma/prisma.service";

export const ERROR_ALERT_RECIPIENTS = ["info@vedha.ae", "saadbhati1002@gmail.com"] as const;

export const clientErrorBody = z.object({
  path: z.string().trim().min(1).max(500),
  method: z.string().trim().max(20).optional().default(""),
  statusCode: z.number().int().min(0).max(599).optional().nullable(),
  code: z.string().trim().max(80).optional().default(""),
  message: z.string().trim().min(1).max(4000),
  details: z.unknown().optional(),
  correlationId: z.string().trim().max(80).optional().default(""),
  userAgent: z.string().trim().max(500).optional().default(""),
});

export type ErrorReportInput = {
  organizationId: string;
  user?: Pick<AuthContext, "id" | "email" | "name" | "vendorId" | "roles"> | null;
  source: "api" | "client" | "upload";
  method?: string;
  path: string;
  statusCode?: number | null;
  code?: string;
  message: string;
  details?: unknown;
  correlationId?: string;
  userAgent?: string;
};

@Injectable()
export class ErrorReportsService {
  private readonly logger = new Logger(ErrorReportsService.name);

  constructor(
    @Inject(TenantService) private readonly tenant: TenantService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
  ) {}

  async record(input: ErrorReportInput) {
    try {
      const context = currentContext();
      const correlationId = input.correlationId || context.correlationId || "";
      const userAgent = input.userAgent || context.userAgent || "";
      const saved = await this.tenant.transaction(input.organizationId, async (tx) => {
        let companyName = "";
        if (input.user?.vendorId) {
          const vendor = await tx.vendor.findFirst({
            where: { id: input.user.vendorId, organizationId: input.organizationId },
            select: { companyName: true },
          });
          companyName = vendor?.companyName ?? "";
        }
        const row = await tx.clientErrorEvent.create({
          data: {
            id: randomUUID(),
            organizationId: input.organizationId,
            userId: input.user?.id ?? null,
            vendorId: input.user?.vendorId ?? null,
            userEmail: input.user?.email ?? "",
            userName: input.user?.name ?? "",
            companyName,
            source: input.source,
            method: (input.method ?? "").slice(0, 20),
            path: input.path.slice(0, 500),
            statusCode: input.statusCode ?? null,
            code: (input.code ?? "").slice(0, 80),
            message: input.message.slice(0, 4000),
            details: input.details === undefined ? Prisma.JsonNull : (input.details as Prisma.InputJsonValue),
            correlationId: correlationId.slice(0, 80),
            userAgent: userAgent.slice(0, 500),
          },
        });
        const fingerprint = createHash("sha256")
          .update([input.path, input.method ?? "", String(input.statusCode ?? ""), input.message.slice(0, 200), input.user?.email ?? ""].join("|"))
          .digest("hex")
          .slice(0, 24);
        const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
        for (const to of ERROR_ALERT_RECIPIENTS) {
          const idempotencyKey = `error-alert:${fingerprint}:${bucket}:${to}`;
          const text = [
            "An API or upload error was reported.",
            "",
            `When: ${row.createdAt.toISOString()}`,
            `Source: ${row.source}`,
            `Path: ${row.method ? `${row.method} ` : ""}${row.path}`,
            `Status: ${row.statusCode ?? "n/a"}`,
            `Code: ${row.code || "n/a"}`,
            `Message: ${row.message}`,
            `Correlation: ${row.correlationId || "n/a"}`,
            "",
            "User",
            `Name: ${row.userName || "n/a"}`,
            `Email: ${row.userEmail || "n/a"}`,
            `Company: ${row.companyName || "n/a"}`,
            `User id: ${row.userId || "n/a"}`,
            `Vendor id: ${row.vendorId || "n/a"}`,
            `Roles: ${input.user?.roles?.join(", ") || "n/a"}`,
            "",
            `User agent: ${row.userAgent || "n/a"}`,
            `Details: ${safeJson(row.details)}`,
          ].join("\n");
          await this.outbox.enqueue(tx, {
            organizationId: input.organizationId,
            type: "email.error-alert",
            idempotencyKey,
            payload: {
              to,
              template: "error-alert",
              audience: "admin",
              subject: `Portal error: ${row.path}`.slice(0, 180),
              title: "Portal error alert",
              text,
              link: "/admin/errors",
              idempotencyKey,
            },
          });
        }
        await tx.clientErrorEvent.update({
          where: { id: row.id },
          data: { alertedAt: new Date() },
        });
        return row;
      });
      return saved;
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack ?? error.message : "Failed to record client error.");
      return null;
    }
  }

  async list(organizationId: string) {
    return this.tenant.transaction(organizationId, (tx) =>
      tx.clientErrorEvent.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  }
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return "[unserializable]";
  }
}
