import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { exportableFields, formatAnswerForExport, formSchemaDefinition, toCsv } from "@vmp/shared";
import nodemailer from "nodemailer";
import { z } from "zod";
import type { AuthContext } from "../common/auth";
import { safeEqualText } from "../common/crypto";
import { env } from "../config/env";
import { AuditService } from "../audit/audit.service";
import { listEmailTemplates } from "../jobs/email-catalog";
import { EMAIL_LOGO_PATH, publicAssetUrl, renderEmail } from "../jobs/email-templates";
import { lookupMailAuth } from "../jobs/mail-auth";
import { senderIdentity, transactionalHeaders } from "../jobs/mail-route";
import { OutboxProcessor } from "../jobs/jobs.service";
import { PrismaService, TenantService } from "../prisma/prisma.service";
import { clientErrorBody, ErrorReportsService } from "./error-reports.service";
import { effectiveSettings, emailSendingBody, emailTemplatesBody, nextEmailSending, nextEmailTemplates, nextStored, parseStored, publicSettings, settingsBody } from "./org-settings";

const formAnswersExportBody = z.object({
  formTemplateId: z.string().uuid(),
  fieldIds: z.array(z.string().uuid()).min(1).max(200),
});

@Injectable()
export class PlatformService {
  constructor(
    @Inject(TenantService) private readonly tenant: TenantService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OutboxProcessor) private readonly processor: OutboxProcessor,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ErrorReportsService) private readonly errors: ErrorReportsService,
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
      const actorIds = [...new Set(activity.flatMap((row) => (row.actorId ? [row.actorId] : [])))];
      const actors = actorIds.length
        ? await tx.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
        : [];
      const actorNames = new Map(actors.map((actor) => [actor.id, actor.name]));
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
            actorName: row.actorId ? (actorNames.get(row.actorId) ?? "Unknown user") : "System",
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
          status: row.status,
          size: row.versions[0]?.sizeBytes ?? 0,
          createdAt: row.createdAt.toISOString(),
        })),
        ["vendor", "filename", "status", "size", "createdAt"],
      );
    });
    return csv;
  }

  /** Fields available for a form export picker (latest published version, else latest draft). */
  async formExportFields(user: AuthContext, formTemplateId: string) {
    const id = z.string().uuid().parse(formTemplateId);
    return this.tenant.transaction(user.organizationId, async (tx) => {
      const template = await tx.formTemplate.findFirst({
        where: { id, organizationId: user.organizationId, archivedAt: null },
        include: {
          versions: { orderBy: [{ publishedAt: "desc" }, { versionNumber: "desc" }], take: 8 },
        },
      });
      if (!template) throw new NotFoundException("Form was not found.");
      const version = template.versions.find((item) => item.publishedAt) ?? template.versions[0];
      if (!version) throw new ConflictException("This form has no versions to export.");
      const parsed = formSchemaDefinition.safeParse(version.schema);
      if (!parsed.success) throw new ConflictException("This form schema could not be read for export.");
      return {
        data: {
          formTemplateId: template.id,
          formName: template.name,
          formVersionId: version.id,
          versionNumber: version.versionNumber,
          fields: exportableFields(parsed.data),
        },
      };
    });
  }

  /**
   * CSV of vendors assigned to a form, with one column per selected field:
   * vendor | field_1 | field_2 | …
   */
  async formAnswersExport(user: AuthContext, body: unknown) {
    const input = formAnswersExportBody.parse(body);
    const csv = await this.tenant.transaction(user.organizationId, async (tx) => {
      const template = await tx.formTemplate.findFirst({
        where: { id: input.formTemplateId, organizationId: user.organizationId, archivedAt: null },
        include: {
          versions: { orderBy: [{ publishedAt: "desc" }, { versionNumber: "desc" }], take: 20 },
        },
      });
      if (!template) throw new NotFoundException("Form was not found.");
      const version = template.versions.find((item) => item.publishedAt) ?? template.versions[0];
      if (!version) throw new ConflictException("This form has no versions to export.");
      const parsed = formSchemaDefinition.safeParse(version.schema);
      if (!parsed.success) throw new ConflictException("This form schema could not be read for export.");
      const available = exportableFields(parsed.data);
      const byId = new Map(available.map((field) => [field.id, field]));
      const selected = input.fieldIds
        .map((fieldId) => byId.get(fieldId))
        .filter((field): field is NonNullable<typeof field> => Boolean(field));
      if (!selected.length) throw new BadRequestException("Select at least one field from this form.");

      const labelCounts = new Map<string, number>();
      for (const field of selected) labelCounts.set(field.label, (labelCounts.get(field.label) ?? 0) + 1);
      const columns = [
        "vendor",
        ...selected.map((field) => (labelCounts.get(field.label)! > 1 ? `${field.label} (${field.key})` : field.label)),
      ];

      const assignments = await tx.formAssignment.findMany({
        where: {
          organizationId: user.organizationId,
          formVersion: { templateId: template.id },
        },
        include: {
          vendor: { select: { companyName: true, email: true, reference: true } },
          submission: {
            select: {
              revisions: {
                orderBy: { revisionNumber: "desc" },
                take: 1,
                select: { data: true },
              },
            },
          },
        },
        orderBy: { vendor: { companyName: "asc" } },
        take: 10_000,
      });

      const answerRows = assignments.map((assignment) => {
        const raw = assignment.submission?.revisions[0]?.data;
        const values = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
        return { vendor: assignment.vendor.companyName, values };
      });

      const documentIds = new Set<string>();
      for (const row of answerRows) {
        for (const field of selected) {
          collectDocumentIdsFromAnswer(field.id in row.values ? row.values[field.id] : row.values[field.key], documentIds);
        }
      }

      const fileMeta = new Map<string, { filename: string; storageKey: string }>();
      if (documentIds.size) {
        const documents = await tx.document.findMany({
          where: {
            organizationId: user.organizationId,
            id: { in: [...documentIds] },
            deletedAt: null,
          },
          include: {
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
              select: { filename: true, storageKey: true },
            },
          },
        });
        for (const document of documents) {
          const latest = document.versions[0];
          if (!latest) continue;
          fileMeta.set(document.id, { filename: latest.filename, storageKey: latest.storageKey });
        }
      }

      const origin = env().WEB_ORIGIN.replace(/\/$/, "");
      const rows = answerRows.map((assignment) => {
        const row: Record<string, unknown> = { vendor: assignment.vendor };
        selected.forEach((field, index) => {
          const column = columns[index + 1]!;
          const value = field.id in assignment.values ? assignment.values[field.id] : assignment.values[field.key];
          row[column] = formatExportAnswer(value, origin, fileMeta);
        });
        return row;
      });

      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "report.form_answers_exported",
        resourceType: "form_template",
        resourceId: template.id,
        newValue: { formName: template.name, fieldCount: selected.length, rowCount: rows.length },
      });

      return toCsv(rows, columns);
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

  async clientErrors(user: AuthContext) {
    const rows = await this.errors.list(user.organizationId);
    return {
      data: rows.map((row) => ({
        id: row.id,
        source: row.source,
        method: row.method,
        path: row.path,
        statusCode: row.statusCode,
        code: row.code,
        message: row.message,
        details: row.details,
        userEmail: row.userEmail,
        userName: row.userName,
        companyName: row.companyName,
        vendorId: row.vendorId,
        correlationId: row.correlationId,
        userAgent: row.userAgent,
        alertedAt: row.alertedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async reportClientError(user: AuthContext, body: unknown, userAgent?: string) {
    const input = clientErrorBody.parse(body);
    const saved = await this.errors.record({
      organizationId: user.organizationId,
      user,
      source: /documents|imports|packets|upload/i.test(input.path) ? "upload" : "client",
      method: input.method,
      path: input.path,
      statusCode: input.statusCode,
      code: input.code,
      message: input.message,
      details: input.details,
      correlationId: input.correlationId,
      userAgent: input.userAgent || userAgent,
    });
    return { data: { id: saved?.id ?? null } };
  }

  async organization(user: AuthContext) {
    const organization = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.organization.findUnique({ where: { id: user.organizationId } }),
    );
    if (!organization) throw new NotFoundException();
    return { data: await this.presentOrganization(organization) };
  }

  async updateOrganization(user: AuthContext, body: unknown) {
    const input = settingsBody.parse(body);
    const uploadCeilingMb = Math.max(1, Math.floor(env().MAX_UPLOAD_BYTES / (1024 * 1024)));
    if (input.maxUploadMb > uploadCeilingMb) {
      throw new ConflictException(`Upload size cannot exceed the server limit of ${uploadCeilingMb} MB.`);
    }
    if (input.importMaxRows > env().IMPORT_MAX_ROWS) {
      throw new ConflictException(`Import rows cannot exceed the server limit of ${env().IMPORT_MAX_ROWS}.`);
    }
    const organization = await this.tenant.transaction(user.organizationId, async (tx) => {
      const existing = await tx.organization.findUnique({ where: { id: user.organizationId } });
      if (!existing) throw new NotFoundException();
      const settings = nextStored(parseStored(existing.settings), input);
      const updated = await tx.organization.update({
        where: { id: user.organizationId },
        data: { name: input.name, settings },
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "organization.settings_updated",
        resourceType: "organization",
        resourceId: user.organizationId,
        newValue: (({ storageAccessKey, ...safe }) => {
          void storageAccessKey;
          return safe;
        })(publicSettings(parseStored(updated.settings))),
      });
      return updated;
    });
    return { data: await this.presentOrganization(organization) };
  }

  async updateEmailSending(user: AuthContext, body: unknown) {
    const input = emailSendingBody.parse(body);
    const result = await this.tenant.transaction(user.organizationId, async (tx) => {
      const existing = await tx.organization.findUnique({ where: { id: user.organizationId } });
      if (!existing) throw new NotFoundException();
      const current = parseStored(existing.settings);
      const wasEnabled = current.emailSendEnabled ?? true;
      const settings = nextEmailSending(current, input.enabled);
      const updated = await tx.organization.update({
        where: { id: user.organizationId },
        data: { settings },
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: input.enabled ? "organization.email_sending_enabled" : "organization.email_sending_disabled",
        resourceType: "organization",
        resourceId: user.organizationId,
        newValue: { emailSendEnabled: input.enabled },
      });
      return { updated, wasEnabled };
    });
    let released = 0;
    if (input.enabled && !result.wasEnabled) {
      released = (await this.processor.releaseHeldEmails(user.organizationId)).released;
    }
    const held = await this.processor.countHeldEmails(user.organizationId);
    return {
      data: {
        emailSendEnabled: input.enabled,
        released,
        held,
        organization: await this.presentOrganization(result.updated),
      },
    };
  }

  async emailSendingStatus(user: AuthContext) {
    const organization = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.organization.findUnique({ where: { id: user.organizationId }, select: { settings: true } }),
    );
    if (!organization) throw new NotFoundException();
    const settings = effectiveSettings(parseStored(organization.settings));
    const held = await this.processor.countHeldEmails(user.organizationId);
    return { data: { emailSendEnabled: settings.emailSendEnabled, held } };
  }

  async emailTemplates(user: AuthContext) {
    const organization = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.organization.findUnique({ where: { id: user.organizationId }, select: { settings: true } }),
    );
    if (!organization) throw new NotFoundException();
    return { data: { templates: listEmailTemplates(parseStored(organization.settings).emailTemplates) } };
  }

  async updateEmailTemplates(user: AuthContext, body: unknown) {
    const input = emailTemplatesBody.parse(body);
    const organization = await this.tenant.transaction(user.organizationId, async (tx) => {
      const existing = await tx.organization.findUnique({ where: { id: user.organizationId } });
      if (!existing) throw new NotFoundException();
      const settings = nextEmailTemplates(parseStored(existing.settings), input);
      const updated = await tx.organization.update({
        where: { id: user.organizationId },
        data: { settings },
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "organization.email_templates_updated",
        resourceType: "organization",
        resourceId: user.organizationId,
        newValue: { keys: Object.keys(input.templates) },
      });
      return updated;
    });
    return { data: { templates: listEmailTemplates(parseStored(organization.settings).emailTemplates) } };
  }

  async sendTestEmail(user: AuthContext, body: unknown) {
    const input = z.object({ to: z.string().trim().email().max(320) }).parse(body);
    const organization = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.organization.findUnique({ where: { id: user.organizationId } }),
    );
    if (!organization) throw new NotFoundException();
    const mail = effectiveSettings(parseStored(organization.settings));
    if (!mail.smtpHost) throw new BadRequestException("Save an SMTP host before sending a test email.");
    const subject = `Test email from ${organization.name}`;
    const bodyText = "This is a test message from iktva. The saved email settings accepted this message.";
    const identity = senderIdentity({
      fromName: mail.emailFromName,
      fromAddress: mail.emailFromAddress,
      smtpUser: mail.smtpUser,
    });
    const webOrigin = env().WEB_ORIGIN;
    const rendered = renderEmail({
      template: "test",
      audience: "admin",
      organizationName: organization.name,
      title: "Test email",
      body: bodyText,
      actionUrl: webOrigin,
      fromAddress: identity.replyTo,
      logoUrl: publicAssetUrl(webOrigin, EMAIL_LOGO_PATH),
    });
    const idempotencyKey = `test:${organization.id}:${randomUUID()}`;
    const record = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.emailMessage.create({
        data: {
          organizationId: user.organizationId,
          toAddress: input.to,
          template: "test",
          subject,
          status: "QUEUED",
          idempotencyKey,
        },
      }),
    );
    const transport = mail.smtpHost === "json"
      ? nodemailer.createTransport({ jsonTransport: true })
      : nodemailer.createTransport({
          host: mail.smtpHost,
          port: mail.smtpPort,
          secure: mail.smtpSecure,
          name: identity.domain,
          auth: mail.smtpUser ? { user: mail.smtpUser, pass: mail.smtpPassword } : undefined,
        });
    try {
      await this.processor.reserveMailSlot(mail.smtpHost);
      const info = await transport.sendMail({
        from: identity.from,
        replyTo: identity.replyTo,
        envelope: { from: identity.envelopeFrom, to: input.to },
        messageId: identity.messageId,
        to: input.to,
        subject,
        text: rendered.text,
        html: rendered.html,
        headers: transactionalHeaders(),
      });
      await this.tenant.transaction(user.organizationId, async (tx) => {
        await tx.emailMessage.update({
          where: { id: record.id },
          data: { status: "SENT", providerMessageId: info.messageId ?? null, attemptCount: { increment: 1 }, lastError: "" },
        });
        await this.audit.record(tx, {
          organizationId: user.organizationId,
          actorId: user.id,
          actorRole: user.roles.join(","),
          action: "organization.test_email_sent",
          resourceType: "email_message",
          resourceId: record.id,
          newValue: { to: input.to },
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : "SMTP send failed.";
      await this.tenant.transaction(user.organizationId, (tx) =>
        tx.emailMessage.update({
          where: { id: record.id },
          data: { status: "FAILED", attemptCount: { increment: 1 }, lastError: message },
        }),
      );
      throw new BadRequestException(`The test email was not accepted. ${message}`);
    }
    return { data: { to: input.to, status: "SENT" as const } };
  }

  private async presentOrganization(organization: { id: string; name: string; slug: string; settings: Prisma.JsonValue }) {
    const config = env();
    const settings = publicSettings(parseStored(organization.settings));
    const mailAuth = await lookupMailAuth(settings.emailFromAddress).catch(() => null);
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      settings,
      mailAuth,
      limits: {
        maxUploadMb: Math.max(1, Math.floor(config.MAX_UPLOAD_BYTES / (1024 * 1024))),
        importMaxRows: config.IMPORT_MAX_ROWS,
      },
    };
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

function collectDocumentIdsFromAnswer(value: unknown, into: Set<string>) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectDocumentIdsFromAnswer(item, into);
    return;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.documentId === "string" && record.documentId) into.add(record.documentId);
    for (const nested of Object.values(record)) collectDocumentIdsFromAnswer(nested, into);
  }
}

/** File cells include filename, portal download URL, and storage key so admins can open/download them. */
function formatExportAnswer(
  value: unknown,
  origin: string,
  fileMeta: Map<string, { filename: string; storageKey: string }>,
): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => formatExportAnswer(item, origin, fileMeta))
      .filter(Boolean)
      .join(" | ");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const documentId = typeof record.documentId === "string" ? record.documentId : "";
    if (documentId) {
      const meta = fileMeta.get(documentId);
      const filename =
        (typeof record.filename === "string" && record.filename.trim())
        || meta?.filename
        || "Uploaded file";
      const downloadUrl = `${origin}/api/v1/documents/${documentId}/content?disposition=attachment`;
      const storageKey = meta?.storageKey ?? "";
      return [filename, downloadUrl, storageKey].filter(Boolean).join(" — ");
    }
    return formatAnswerForExport(value);
  }
  return formatAnswerForExport(value);
}
