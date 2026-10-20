import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { formSchemaDefinition } from "@vmp/shared";
import { z } from "zod";
import type { AuthContext } from "../common/auth";
import { decodeCursor, encodeCursor } from "../common/http";
import { env } from "../config/env";
import { AuditService } from "../audit/audit.service";
import { OutboxProcessor, OutboxService } from "../jobs/jobs.service";
import { TenantService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(TenantService) private readonly tenant: TenantService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(OutboxProcessor) private readonly processor: OutboxProcessor,
  ) {}

  async upload(
    user: AuthContext,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
    fields: { vendorId?: string; assignmentId?: string; fieldId?: string; category?: string },
  ) {
    if (!file) throw new ConflictException("Choose a file to upload.");
    if (file.size > env().MAX_UPLOAD_BYTES) throw new ConflictException("The file is larger than the allowed limit.");
    const vendorId = user.vendorId ?? fields.vendorId;
    if (!vendorId) throw new ForbiddenException("A vendor is required.");
    if (user.vendorId && fields.vendorId && fields.vendorId !== user.vendorId) throw new NotFoundException();
    const documentId = randomUUID();
    const versionId = randomUUID();
    const storageKey = `org/${user.organizationId}/vendor/${vendorId}/${documentId}/${versionId}`;
    const saved = await this.tenant.transaction(user.organizationId, async (tx) => {
      const vendor = await tx.vendor.findFirst({ where: { id: vendorId, organizationId: user.organizationId } });
      if (!vendor) throw new NotFoundException();
      if (fields.assignmentId) {
        const assignment = await tx.formAssignment.findFirst({
          where: { id: fields.assignmentId, organizationId: user.organizationId, vendorId },
          include: { formVersion: true, submission: { include: { corrections: { where: { status: "OPEN" }, include: { fields: true } } } } },
        });
        if (!assignment) throw new NotFoundException();
        const editable =
          assignment.status === "INVITED" || assignment.status === "IN_PROGRESS"
            ? true
            : assignment.status === "CORRECTION_REQUESTED" &&
              !!fields.fieldId &&
              assignment.submission?.corrections[0]?.fields.some((field) => field.fieldId === fields.fieldId);
        if (user.vendorId && !editable) throw new ConflictException("This form is not accepting files.");
        if (fields.fieldId) {
          const schema = formSchemaDefinition.parse(assignment.formVersion.schema);
          const field = schema.fields.find((item) => item.id === fields.fieldId);
          if (!field || !["file", "files", "image"].includes(field.type)) throw new ConflictException("That field does not accept files.");
        }
      }
      await this.storage.put(storageKey, file.buffer, file.mimetype || "application/octet-stream");
      const filename = file.originalname.replace(/[^\w.\- ]+/g, "_").slice(0, 180) || "upload";
      const document = await tx.document.create({
        data: {
          id: documentId,
          organizationId: user.organizationId,
          vendorId,
          exhibitionId: null,
          assignmentId: fields.assignmentId ?? null,
          fieldId: fields.fieldId ?? null,
          category: (fields.category ?? "form-upload").slice(0, 80),
          status: "QUARANTINED",
          versions: {
            create: {
              id: versionId,
              organizationId: user.organizationId,
              versionNumber: 1,
              storageKey,
              filename,
              mimeType: file.mimetype || "application/octet-stream",
              sizeBytes: file.size,
              checksum: createHash("sha256").update(file.buffer).digest("hex"),
              uploadedById: user.id,
              scanStatus: "pending",
            },
          },
        },
        include: { versions: true },
      });
      if (fields.assignmentId) {
        const assignment = await tx.formAssignment.findFirst({ where: { id: fields.assignmentId } });
        if (assignment?.exhibitionId) {
          await tx.document.update({ where: { id: documentId }, data: { exhibitionId: assignment.exhibitionId } });
        }
      }
      const idempotencyKey = `scan:${versionId}`;
      await this.outbox.enqueue(tx, {
        organizationId: user.organizationId,
        type: "document.scan",
        idempotencyKey,
        payload: { documentId, versionId, idempotencyKey },
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "document.uploaded",
        resourceType: "document",
        resourceId: documentId,
        vendorId,
        fieldId: fields.fieldId ?? null,
        newValue: { filename, size: file.size },
      });
      return document;
    });
    if (env().JOBS_MODE === "inline") await this.processor.flush(5);
    const fresh = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.document.findFirst({ where: { id: saved.id }, include: { versions: true } }),
    );
    return { data: fresh };
  }

  async list(user: AuthContext, query: { cursor?: string; q?: string; vendorId?: string; exhibitionId?: string; status?: string; limit?: string }) {
    if (user.vendorId && query.vendorId && query.vendorId !== user.vendorId) throw new NotFoundException();
    const vendorId = user.vendorId ?? query.vendorId;
    const limit = Math.min(Number(query.limit ?? 25) || 25, 100);
    const cursor = decodeCursor(query.cursor);
    const rows = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.document.findMany({
        where: {
          organizationId: user.organizationId,
          deletedAt: null,
          ...(vendorId ? { vendorId } : {}),
          ...(query.exhibitionId ? { exhibitionId: query.exhibitionId } : {}),
          ...(query.status ? { status: query.status as "AVAILABLE" } : {}),
          ...(query.q ? { versions: { some: { filename: { contains: query.q, mode: "insensitive" } } } } : {}),
          ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}),
        },
        include: {
          vendor: { select: { id: true, companyName: true, reference: true } },
          exhibition: { select: { id: true, name: true } },
          versions: { orderBy: { versionNumber: "desc" }, take: 5 },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      }),
    );
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return { data: page, nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null };
  }

  async archiveTree(user: AuthContext, vendorId: string) {
    if (user.vendorId && user.vendorId !== vendorId) throw new NotFoundException();
    const data = await this.tenant.transaction(user.organizationId, async (tx) => {
      const vendor = await tx.vendor.findFirst({ where: { id: vendorId, organizationId: user.organizationId } });
      if (!vendor) throw new NotFoundException();
      const documents = await tx.document.findMany({
        where: { organizationId: user.organizationId, vendorId, deletedAt: null },
        include: {
          exhibition: true,
          assignment: { include: { formVersion: { include: { template: true } } } },
          versions: { orderBy: { versionNumber: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      });
      return { vendor, documents };
    });
    return { data };
  }

  async read(user: AuthContext, id: string, disposition?: string) {
    const document = await this.tenant.transaction(user.organizationId, async (tx) => {
      const found = await tx.document.findFirst({
        where: { id, organizationId: user.organizationId, deletedAt: null, ...(user.vendorId ? { vendorId: user.vendorId } : {}) },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      });
      if (!found || !found.versions[0]) throw new NotFoundException();
      if (found.status !== "AVAILABLE" && !user.permissions.includes("documents.read")) {
        throw new ConflictException("This file is not available.");
      }
      if (found.status === "QUARANTINED" || found.status === "REJECTED") {
        throw new ConflictException("This file is not available for download.");
      }
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "document.downloaded",
        resourceType: "document",
        resourceId: id,
        vendorId: found.vendorId,
      });
      return found;
    });
    const version = document.versions[0];
    const bytes = await this.storage.get(version.storageKey);
    const image = version.mimeType.startsWith("image/") && version.mimeType !== "image/svg+xml";
    const inline = disposition === "inline" && image;
    const filename = version.filename.replace(/["\r\n]/g, "");
    return { bytes, mimeType: version.mimeType, filename, inline };
  }

  async presign(user: AuthContext, id: string) {
    const document = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.document.findFirst({
        where: { id, organizationId: user.organizationId, status: "AVAILABLE", deletedAt: null, ...(user.vendorId ? { vendorId: user.vendorId } : {}) },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      }),
    );
    if (!document?.versions[0]) throw new NotFoundException();
    const url = await this.storage.presign(document.versions[0].storageKey, 60);
    await this.tenant.transaction(user.organizationId, (tx) =>
      this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "document.presigned",
        resourceType: "document",
        resourceId: id,
        vendorId: document.vendorId,
      }),
    );
    return { data: { url, expiresInSeconds: url ? 60 : 0 } };
  }

  async archive(user: AuthContext, id: string) {
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const document = await tx.document.findFirst({ where: { id, organizationId: user.organizationId, ...(user.vendorId ? { vendorId: user.vendorId } : {}) } });
      if (!document) throw new NotFoundException();
      await tx.document.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "document.archived",
        resourceType: "document",
        resourceId: id,
        vendorId: document.vendorId,
      });
    });
    return { data: { archived: true } };
  }
}

export const uploadFields = z.object({
  vendorId: z.string().uuid().optional(),
  assignmentId: z.string().uuid().optional(),
  fieldId: z.string().uuid().optional(),
  category: z.string().max(80).optional(),
});
