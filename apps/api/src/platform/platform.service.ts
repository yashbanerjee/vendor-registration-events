import { Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { toCsv } from "@vmp/shared";
import { z } from "zod";
import type { AuthContext } from "../common/auth";
import { safeEqualText } from "../common/crypto";
import { env } from "../config/env";
import { OutboxProcessor } from "../jobs/jobs.service";
import { PrismaService, TenantService } from "../prisma/prisma.service";

@Injectable()
export class PlatformService {
  constructor(
    @Inject(TenantService) private readonly tenant: TenantService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OutboxProcessor) private readonly processor: OutboxProcessor,
  ) {}

  async dashboard(user: AuthContext) {
    return this.tenant.transaction(user.organizationId, async (tx) => {
      const organizationId = user.organizationId;
      const now = new Date();
      const [vendors, grouped, overdue, failedEmails, pendingDocuments, recent, deadlines, activity] = await Promise.all([
        tx.vendor.count({ where: { organizationId, archivedAt: null } }),
        tx.formAssignment.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } }),
        tx.formAssignment.count({
          where: {
            organizationId,
            deadline: { lt: now },
            status: { in: ["INVITED", "IN_PROGRESS", "CORRECTION_REQUESTED"] },
          },
        }),
        tx.emailMessage.count({ where: { organizationId, status: "FAILED" } }),
        tx.document.count({ where: { organizationId, status: "QUARANTINED", deletedAt: null } }),
        tx.formAssignment.findMany({
          where: { organizationId, submittedAt: { not: null } },
          include: { vendor: true, formVersion: { include: { template: true } } },
          orderBy: { submittedAt: "desc" },
          take: 8,
        }),
        tx.formAssignment.findMany({
          where: { organizationId, deadline: { gte: now }, status: { notIn: ["APPROVED", "REVOKED", "REJECTED"] } },
          include: { vendor: true, exhibition: true },
          orderBy: { deadline: "asc" },
          take: 8,
        }),
        tx.auditLog.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 12 }),
      ]);
      const count = (status: string) => grouped.find((row) => row.status === status)?._count._all ?? 0;
      return {
        data: {
          counts: {
            vendors,
            invited: count("INVITED"),
            incomplete: count("INVITED") + count("IN_PROGRESS") + count("CORRECTION_REQUESTED"),
            pendingReview: count("SUBMITTED_PENDING_REVIEW"),
            corrections: count("CORRECTION_REQUESTED"),
            resubmissions: count("RESUBMITTED_PENDING_REVIEW"),
            approved: count("APPROVED"),
            overdue,
            failedEmails,
            pendingDocuments,
          },
          byStatus: grouped.map((row) => ({ status: row.status, count: row._count._all })),
          recentSubmissions: recent.map((row) => ({
            id: row.id,
            vendor: row.vendor.companyName,
            form: row.formVersion.template.name,
            status: row.status,
            submittedAt: row.submittedAt,
          })),
          deadlines: deadlines.map((row) => ({
            id: row.id,
            vendor: row.vendor.companyName,
            exhibition: row.exhibition.name,
            deadline: row.deadline,
            status: row.status,
          })),
          activity: activity.map((row) => ({
            id: row.id,
            action: row.action,
            resourceType: row.resourceType,
            createdAt: row.createdAt,
            actorId: row.actorId,
          })),
        },
      };
    });
  }

  async search(user: AuthContext, q: string) {
    const query = q.trim();
    if (query.length < 2) return { data: [] };
    return this.tenant.transaction(user.organizationId, async (tx) => {
      const [vendors, exhibitions, forms] = await Promise.all([
        tx.vendor.findMany({
          where: {
            organizationId: user.organizationId,
            ...(user.vendorId ? { id: user.vendorId } : {}),
            OR: [
              { companyName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { reference: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 8,
        }),
        user.vendorId
          ? Promise.resolve([])
          : tx.exhibition.findMany({
              where: { organizationId: user.organizationId, name: { contains: query, mode: "insensitive" } },
              take: 5,
            }),
        user.vendorId
          ? Promise.resolve([])
          : tx.formTemplate.findMany({
              where: { organizationId: user.organizationId, name: { contains: query, mode: "insensitive" }, archivedAt: null },
              take: 5,
            }),
      ]);
      return {
        data: [
          ...vendors.map((vendor) => ({ type: "vendor", id: vendor.id, label: vendor.companyName, hint: vendor.reference })),
          ...exhibitions.map((exhibition) => ({ type: "exhibition", id: exhibition.id, label: exhibition.name, hint: exhibition.code })),
          ...forms.map((form) => ({ type: "form", id: form.id, label: form.name, hint: form.scope })),
        ],
      };
    });
  }

  async notifications(user: AuthContext) {
    const rows = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.notification.findMany({ where: { userId: user.id, organizationId: user.organizationId }, orderBy: { createdAt: "desc" }, take: 30 }),
    );
    return { data: rows };
  }

  async markRead(user: AuthContext, id: string) {
    const result = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.notification.updateMany({ where: { id, userId: user.id, organizationId: user.organizationId }, data: { readAt: new Date() } }),
    );
    if (!result.count) throw new NotFoundException();
    return { data: { read: true } };
  }

  async audits(user: AuthContext, cursor?: string) {
    const rows = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.auditLog.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      }),
    );
    return { data: rows, nextCursor: rows.length === 50 ? rows.at(-1)?.id ?? null : null };
  }

  async report(user: AuthContext, kind: "vendors" | "submissions" | "corrections" | "emails" | "documents") {
    const csv = await this.tenant.transaction(user.organizationId, async (tx) => {
      if (kind === "vendors") {
        const rows = await tx.vendor.findMany({ where: { organizationId: user.organizationId }, orderBy: { companyName: "asc" }, take: 5000 });
        return toCsv(rows.map((row) => ({ ...row, additionalEmails: row.additionalEmails.join(";") })), [
          "reference",
          "companyName",
          "contactName",
          "email",
          "phone",
          "category",
          "status",
          "country",
        ]);
      }
      if (kind === "submissions") {
        const rows = await tx.formAssignment.findMany({
          where: { organizationId: user.organizationId },
          include: { vendor: true, exhibition: true, formVersion: { include: { template: true } } },
          take: 5000,
        });
        return toCsv(
          rows.map((row) => ({
            vendor: row.vendor.companyName,
            email: row.vendor.email,
            exhibition: row.exhibition.name,
            form: row.formVersion.template.name,
            version: row.formVersion.versionNumber,
            status: row.status,
            deadline: row.deadline?.toISOString() ?? "",
            approvedAt: row.approvedAt?.toISOString() ?? "",
          })),
          ["vendor", "email", "exhibition", "form", "version", "status", "deadline", "approvedAt"],
        );
      }
      if (kind === "corrections") {
        const rows = await tx.correctionRequest.findMany({
          where: { organizationId: user.organizationId },
          include: { fields: true, submission: { include: { assignment: { include: { vendor: true } } } } },
          take: 5000,
        });
        return toCsv(
          rows.flatMap((row) =>
            row.fields.map((field) => ({
              vendor: row.submission.assignment.vendor.companyName,
              status: row.status,
              fieldId: field.fieldId,
              note: field.note,
              createdAt: row.createdAt.toISOString(),
            })),
          ),
          ["vendor", "status", "fieldId", "note", "createdAt"],
        );
      }
      if (kind === "emails") {
        const rows = await tx.emailMessage.findMany({ where: { organizationId: user.organizationId }, orderBy: { createdAt: "desc" }, take: 5000 });
        return toCsv(
          rows.map((row) => ({
            to: row.toAddress,
            template: row.template,
            subject: row.subject,
            status: row.status,
            attempts: row.attemptCount,
            lastError: row.lastError,
            createdAt: row.createdAt.toISOString(),
          })),
          ["to", "template", "subject", "status", "attempts", "lastError", "createdAt"],
        );
      }
      const rows = await tx.document.findMany({
        where: { organizationId: user.organizationId, deletedAt: null },
        include: { vendor: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
        take: 5000,
      });
      return toCsv(
        rows.map((row) => ({
          vendor: row.vendor.companyName,
          filename: row.versions[0]?.filename ?? "",
          category: row.category,
          status: row.status,
          size: row.versions[0]?.sizeBytes ?? 0,
          createdAt: row.createdAt.toISOString(),
        })),
        ["vendor", "filename", "category", "status", "size", "createdAt"],
      );
    });
    return csv;
  }

  async jobs(user: AuthContext) {
    const [outbox, emails] = await this.tenant.transaction(user.organizationId, (tx) =>
      Promise.all([
        tx.outboxEvent.findMany({
          where: { organizationId: user.organizationId },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, type: true, status: true, attempts: true, lastError: true, createdAt: true, publishedAt: true },
        }),
        tx.emailMessage.findMany({
          where: { organizationId: user.organizationId },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, toAddress: true, template: true, subject: true, status: true, attemptCount: true, lastError: true, createdAt: true },
        }),
      ]),
    );
    return { data: { outbox, emails } };
  }

  async retryJob(user: AuthContext, id: string) {
    const updated = await this.processor.retry(user.organizationId, id);
    if (!updated) throw new NotFoundException("That failed job was not found.");
    return { data: { id: updated.id, status: updated.status } };
  }

  async organization(user: AuthContext) {
    const organization = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.organization.findUnique({ where: { id: user.organizationId } }),
    );
    return { data: organization };
  }

  async updateOrganization(user: AuthContext, body: unknown) {
    const input = z.object({ name: z.string().min(2).max(200) }).parse(body);
    const organization = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.organization.update({ where: { id: user.organizationId }, data: { name: input.name } }),
    );
    return { data: organization };
  }

  async providerEvent(header: string | undefined, body: unknown) {
    const secret = env().EMAIL_WEBHOOK_SECRET;
    if (!secret || !header || !safeEqualText(header, secret)) throw new UnauthorizedException("Invalid webhook secret.");
    const input = z.object({
      idempotencyKey: z.string().min(3),
      status: z.enum(["DELIVERED", "BOUNCED", "FAILED"]),
    }).parse(body);
    const message = await this.tenant.unscoped(async (tx) => {
      const existing = await tx.emailMessage.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (!existing) throw new NotFoundException();
      if (existing.status === "DELIVERED" && input.status !== "BOUNCED") return existing;
      await tx.emailMessage.update({ where: { id: existing.id }, data: { status: input.status } });
      await tx.emailDeliveryEvent.create({
        data: {
          organizationId: existing.organizationId,
          emailMessageId: existing.id,
          status: input.status,
          source: "provider_webhook",
          payload: { status: input.status },
        },
      });
      return existing;
    });
    return { data: { id: message.id, status: input.status } };
  }

  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    const roles = await this.prisma.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;
    const role = roles[0];
    return {
      data: {
        status: "ok",
        database: "up",
        role: role?.rolsuper || role?.rolbypassrls ? "privileged" : "restricted",
      },
    };
  }
}
