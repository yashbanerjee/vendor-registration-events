import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthContext } from "../common/auth";
import { env } from "../config/env";
import { AuditService } from "../audit/audit.service";
import { mimeForFilename, scanBuffer } from "../documents/scan";
import { OutboxProcessor, OutboxService } from "../jobs/jobs.service";
import { effectiveSettings, parseStored } from "../platform/org-settings";
import { TenantService, type Tx } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

type Upload = { buffer: Buffer; originalname: string; mimetype: string; size: number };

const noteSchema = z.object({ note: z.string().trim().min(1).max(2000) });

@Injectable()
export class PacketsService {
  constructor(
    @Inject(TenantService) private readonly tenant: TenantService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(OutboxProcessor) private readonly processor: OutboxProcessor,
  ) {}

  async addForm(user: AuthContext, exhibitionId: string, name: string, file: Upload | undefined) {
    const label = z.string().trim().min(2).max(160).parse(name);
    const stored = await this.store(user, file, { pdfOnly: true, keyPrefix: `org/${user.organizationId}/exhibitions/${exhibitionId}/forms` });
    const created = await this.tenant.transaction(user.organizationId, async (tx) => {
      const exhibition = await tx.exhibition.findFirst({ where: { id: exhibitionId, organizationId: user.organizationId } });
      if (!exhibition) throw new NotFoundException();
      const form = await tx.exhibitionForm.create({
        data: {
          organizationId: user.organizationId,
          exhibitionId,
          name: label,
          ...stored,
          createdById: user.id,
        },
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "exhibition_form.created",
        resourceType: "exhibition_form",
        resourceId: form.id,
        newValue: { name: label, exhibitionId },
      });
      await this.mailVendors(tx, user.organizationId, exhibitionId, {
        subject: `New form for ${exhibition.name}`,
        title: `New form for ${exhibition.name}`,
        text: `${label} was added for ${exhibition.name}. Sign in and download it from your dashboard. Fill it in, then upload the completed PDF. You can also attach any extra documents with a name.`,
      });
      return form;
    });
    await this.flush();
    return { data: { id: created.id, name: created.name, filename: created.filename } };
  }

  async assignVendors(user: AuthContext, exhibitionId: string, body: unknown) {
    const input = z.object({ vendorIds: z.array(z.string().uuid()).min(1).max(100) }).parse(body);
    const assigned = await this.tenant.transaction(user.organizationId, async (tx) => {
      const exhibition = await tx.exhibition.findFirst({ where: { id: exhibitionId, organizationId: user.organizationId } });
      if (!exhibition) throw new NotFoundException();
      const forms = await tx.exhibitionForm.findMany({
        where: { organizationId: user.organizationId, exhibitionId },
        select: { name: true },
        orderBy: { createdAt: "asc" },
      });
      const vendors = await tx.vendor.findMany({
        where: { id: { in: input.vendorIds }, organizationId: user.organizationId, archivedAt: null },
        select: { id: true, email: true, users: { select: { id: true }, take: 1 } },
      });
      if (vendors.length !== input.vendorIds.length) throw new NotFoundException("A selected vendor was not found.");
      const already = await tx.vendorExhibition.findMany({
        where: { organizationId: user.organizationId, exhibitionId, vendorId: { in: vendors.map((vendor) => vendor.id) } },
        select: { vendorId: true },
      });
      const linked = new Set(already.map((row) => row.vendorId));
      const fresh = vendors.filter((vendor) => !linked.has(vendor.id));
      if (fresh.length) {
        await tx.vendorExhibition.createMany({
          data: fresh.map((vendor) => ({ organizationId: user.organizationId, vendorId: vendor.id, exhibitionId })),
        });
      }
      const names = forms.map((form) => form.name).join(", ");
      const text = names
        ? `You are invited to ${exhibition.name}. Download these forms from your dashboard, fill them in, and upload the completed PDFs: ${names}. You can also attach extra documents with a name.`
        : `You are invited to ${exhibition.name}. Sign in to your dashboard. PDF forms for this exhibition will appear there.`;
      for (const vendor of fresh) {
        await this.mailOne(tx, user.organizationId, vendor, {
          subject: `Forms for ${exhibition.name}`,
          title: `Forms for ${exhibition.name}`,
          text,
          idempotencyKey: `packet-assign:${exhibitionId}:${vendor.id}:${randomUUID()}`,
        });
      }
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "exhibition_form.vendors_assigned",
        resourceType: "exhibition",
        resourceId: exhibitionId,
        newValue: { vendorIds: fresh.map((vendor) => vendor.id) },
      });
      return fresh.length;
    });
    await this.flush();
    return { data: { assigned } };
  }

  async exhibitionPackets(user: AuthContext, exhibitionId: string) {
    const data = await this.tenant.transaction(user.organizationId, async (tx) => {
      const exhibition = await tx.exhibition.findFirst({ where: { id: exhibitionId, organizationId: user.organizationId } });
      if (!exhibition) throw new NotFoundException();
      const forms = await tx.exhibitionForm.findMany({
        where: { organizationId: user.organizationId, exhibitionId },
        orderBy: { createdAt: "asc" },
        include: {
          returns: {
            include: {
              vendor: { select: { id: true, companyName: true, email: true, reference: true } },
              files: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      });
      const links = await tx.vendorExhibition.findMany({
        where: { organizationId: user.organizationId, exhibitionId, vendor: { archivedAt: null } },
        select: { vendor: { select: { id: true, companyName: true, email: true, reference: true } } },
        orderBy: { vendor: { companyName: "asc" } },
      });
      return { forms, links };
    });
    const vendors = new Map(data.links.map((link) => [link.vendor.id, link.vendor]));
    for (const form of data.forms) {
      for (const row of form.returns) vendors.set(row.vendor.id, row.vendor);
    }
    return {
      data: {
        forms: data.forms.map((form) => ({ id: form.id, name: form.name, filename: form.filename, createdAt: form.createdAt })),
        vendors: [...vendors.values()]
          .sort((left, right) => left.companyName.localeCompare(right.companyName))
          .map((vendor) => ({
            ...vendor,
            forms: data.forms.map((form) => {
              const row = form.returns.find((item) => item.vendorId === vendor.id);
              return {
                formId: form.id,
                formName: form.name,
                returnId: row?.id ?? null,
                status: viewStatus(row?.status ?? "AWAITING", row?.uploadedAt, row?.requestedAt, Boolean(row?.filename)),
                filename: row?.filename || "",
                submittedAt: row?.submittedAt ?? null,
                adminNote: row?.adminNote ?? "",
                files: (row?.files ?? []).map((file) => ({
                  id: file.id,
                  name: file.name,
                  filename: file.filename,
                  status: viewStatus(file.status, file.uploadedAt, file.requestedAt, Boolean(file.filename)),
                  adminNote: file.adminNote,
                })),
              };
            }),
          })),
      },
    };
  }

  async mine(user: AuthContext) {
    if (!user.vendorId) throw new ForbiddenException("Only a vendor can open these forms.");
    const vendorId = user.vendorId;
    const forms = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.exhibitionForm.findMany({
        where: { organizationId: user.organizationId, exhibition: { vendors: { some: { vendorId } } } },
        orderBy: { createdAt: "asc" },
        include: {
          exhibition: { select: { id: true, name: true, venue: true } },
          returns: { where: { vendorId }, include: { files: { orderBy: { createdAt: "asc" } } } },
        },
      }),
    );
    return {
      data: forms.map((form) => {
        const row = form.returns[0];
        return {
          id: form.id,
          name: form.name,
          filename: form.filename,
          exhibition: form.exhibition,
          returnId: row?.id ?? null,
          status: viewStatus(row?.status ?? "AWAITING", row?.uploadedAt, row?.requestedAt, Boolean(row?.filename)),
          filledName: row?.filename || "",
          submittedAt: row?.submittedAt ?? null,
          adminNote: row?.adminNote ?? "",
          files: (row?.files ?? []).map((file) => ({
            id: file.id,
            name: file.name,
            filename: file.filename,
            status: viewStatus(file.status, file.uploadedAt, file.requestedAt, Boolean(file.filename)),
            adminNote: file.adminNote,
          })),
        };
      }),
    };
  }

  async downloadBlank(user: AuthContext, formId: string) {
    const form = await this.tenant.transaction(user.organizationId, async (tx) => {
      const found = await tx.exhibitionForm.findFirst({ where: { id: formId, organizationId: user.organizationId } });
      if (!found) throw new NotFoundException();
      if (user.vendorId) {
        const link = await tx.vendorExhibition.findFirst({ where: { vendorId: user.vendorId, exhibitionId: found.exhibitionId } });
        if (!link) throw new NotFoundException();
      }
      return found;
    });
    return this.readStored(user.organizationId, form.storageKey, form.filename, form.mimeType);
  }

  async downloadReturn(user: AuthContext, returnId: string) {
    const row = await this.tenant.transaction(user.organizationId, async (tx) => {
      const found = await tx.exhibitionFormReturn.findFirst({ where: { id: returnId, organizationId: user.organizationId } });
      if (!found || !found.storageKey) throw new NotFoundException();
      if (user.vendorId && found.vendorId !== user.vendorId) throw new NotFoundException();
      return found;
    });
    return this.readStored(user.organizationId, row.storageKey, row.filename, row.mimeType);
  }

  async downloadFile(user: AuthContext, fileId: string) {
    const row = await this.tenant.transaction(user.organizationId, async (tx) => {
      const found = await tx.exhibitionFormFile.findFirst({
        where: { id: fileId, organizationId: user.organizationId },
        include: { formReturn: true },
      });
      if (!found) throw new NotFoundException();
      if (user.vendorId && found.formReturn.vendorId !== user.vendorId) throw new NotFoundException();
      return found;
    });
    return this.readStored(user.organizationId, row.storageKey, row.filename, row.mimeType);
  }

  async uploadFilled(user: AuthContext, formId: string, file: Upload | undefined) {
    const vendorId = this.requireVendor(user);
    const stored = await this.store(user, file, { pdfOnly: true, keyPrefix: `org/${user.organizationId}/vendor/${vendorId}/packets/${formId}` });
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const form = await this.vendorForm(tx, user.organizationId, vendorId, formId);
      const current = await this.ensureReturn(tx, user.organizationId, form.id, vendorId);
      if (current.status === "SUBMITTED") throw new ConflictException("This form is already with the reviewer.");
      await tx.exhibitionFormReturn.update({
        where: { id: current.id },
        data: { ...stored, uploadedAt: new Date() },
      });
    });
    return this.mine(user);
  }

  async uploadExtra(user: AuthContext, formId: string, name: string, file: Upload | undefined) {
    const vendorId = this.requireVendor(user);
    const label = z.string().trim().min(2).max(160).parse(name);
    const stored = await this.store(user, file, { pdfOnly: false, keyPrefix: `org/${user.organizationId}/vendor/${vendorId}/packets/${formId}/files` });
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const form = await this.vendorForm(tx, user.organizationId, vendorId, formId);
      const current = await this.ensureReturn(tx, user.organizationId, form.id, vendorId);
      if (current.status === "SUBMITTED") throw new ConflictException("This form is already with the reviewer.");
      await tx.exhibitionFormFile.create({
        data: {
          organizationId: user.organizationId,
          returnId: current.id,
          name: label,
          status: "AWAITING",
          ...stored,
          uploadedAt: new Date(),
        },
      });
    });
    return this.mine(user);
  }

  async replaceExtra(user: AuthContext, fileId: string, file: Upload | undefined) {
    const vendorId = this.requireVendor(user);
    const stored = await this.store(user, file, { pdfOnly: false, keyPrefix: `org/${user.organizationId}/vendor/${vendorId}/packets/files/${fileId}` });
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const existing = await tx.exhibitionFormFile.findFirst({
        where: { id: fileId, organizationId: user.organizationId },
        include: { formReturn: true },
      });
      if (!existing || existing.formReturn.vendorId !== vendorId) throw new NotFoundException();
      if (existing.status !== "REUPLOAD") throw new ConflictException("This document was not sent back for a new upload.");
      await tx.exhibitionFormFile.update({ where: { id: existing.id }, data: { ...stored, uploadedAt: new Date() } });
    });
    return this.mine(user);
  }

  async submit(user: AuthContext, formId: string) {
    const vendorId = this.requireVendor(user);
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const form = await this.vendorForm(tx, user.organizationId, vendorId, formId);
      const current = await tx.exhibitionFormReturn.findFirst({
        where: { exhibitionFormId: form.id, vendorId, organizationId: user.organizationId },
        include: { files: true },
      });
      if (!current?.storageKey) throw new ConflictException("Upload the filled PDF before submitting.");
      if (current.status === "SUBMITTED") throw new ConflictException("This form is already with the reviewer.");
      if (current.requestedAt && !replacedAfter(current.uploadedAt, current.requestedAt)) {
        throw new ConflictException("Upload a new copy of the form before submitting.");
      }
      const waiting = current.files.find((file) => file.status === "REUPLOAD" && !replacedAfter(file.uploadedAt, file.requestedAt));
      if (waiting) throw new ConflictException(`Upload a new copy of ${waiting.name} before submitting.`);
      await tx.exhibitionFormReturn.update({
        where: { id: current.id },
        data: { status: "SUBMITTED", submittedAt: new Date(), adminNote: "", requestedAt: null },
      });
      await tx.exhibitionFormFile.updateMany({
        where: { returnId: current.id, status: { in: ["AWAITING", "REUPLOAD"] } },
        data: { status: "SUBMITTED", adminNote: "", requestedAt: null },
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "exhibition_form.submitted",
        resourceType: "exhibition_form_return",
        resourceId: current.id,
        vendorId,
      });
    });
    return this.mine(user);
  }

  async requestFormReupload(user: AuthContext, returnId: string, body: unknown) {
    const input = noteSchema.parse(body);
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const row = await tx.exhibitionFormReturn.findFirst({
        where: { id: returnId, organizationId: user.organizationId },
        include: { form: { include: { exhibition: true } }, vendor: { include: { users: { select: { id: true }, take: 1 } } } },
      });
      if (!row) throw new NotFoundException();
      if (row.status !== "SUBMITTED" && row.status !== "REUPLOAD") throw new ConflictException("The vendor has not submitted this form yet.");
      const requestedAt = new Date();
      await tx.exhibitionFormReturn.update({
        where: { id: row.id },
        data: { status: "REUPLOAD", adminNote: input.note, requestedAt },
      });
      await this.mailOne(tx, user.organizationId, row.vendor, {
        subject: `Please re-upload ${row.form.name}`,
        title: `Please re-upload ${row.form.name}`,
        text: `${row.form.name} for ${row.form.exhibition.name} needs a new upload.\n\n${input.note}\n\nSign in, replace the file, and submit it again.`,
        idempotencyKey: `packet-reupload:${row.id}:${requestedAt.getTime()}`,
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "exhibition_form.reupload_requested",
        resourceType: "exhibition_form_return",
        resourceId: row.id,
        vendorId: row.vendorId,
        newValue: { note: input.note },
      });
    });
    await this.flush();
    return { data: { ok: true } };
  }

  async requestFileReupload(user: AuthContext, fileId: string, body: unknown) {
    const input = noteSchema.parse(body);
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const file = await tx.exhibitionFormFile.findFirst({
        where: { id: fileId, organizationId: user.organizationId },
        include: { formReturn: { include: { form: { include: { exhibition: true } }, vendor: { include: { users: { select: { id: true }, take: 1 } } } } } },
      });
      if (!file) throw new NotFoundException();
      if (file.formReturn.status === "AWAITING") throw new ConflictException("The vendor has not submitted this form yet.");
      const requestedAt = new Date();
      await tx.exhibitionFormFile.update({
        where: { id: file.id },
        data: { status: "REUPLOAD", adminNote: input.note, requestedAt },
      });
      await tx.exhibitionFormReturn.update({
        where: { id: file.returnId },
        data: { status: "REUPLOAD" },
      });
      await this.mailOne(tx, user.organizationId, file.formReturn.vendor, {
        subject: `Please re-upload ${file.name}`,
        title: `Please re-upload ${file.name}`,
        text: `${file.name} on ${file.formReturn.form.name} for ${file.formReturn.form.exhibition.name} needs a new upload.\n\n${input.note}\n\nSign in, replace that document, and submit the form again.`,
        idempotencyKey: `packet-file-reupload:${file.id}:${requestedAt.getTime()}`,
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "exhibition_form_file.reupload_requested",
        resourceType: "exhibition_form_file",
        resourceId: file.id,
        vendorId: file.formReturn.vendorId,
        newValue: { note: input.note, name: file.name },
      });
    });
    await this.flush();
    return { data: { ok: true } };
  }

  private requireVendor(user: AuthContext) {
    if (!user.vendorId) throw new ForbiddenException("Only a vendor can upload these forms.");
    return user.vendorId;
  }

  private async vendorForm(tx: Tx, organizationId: string, vendorId: string, formId: string) {
    const form = await tx.exhibitionForm.findFirst({ where: { id: formId, organizationId } });
    if (!form) throw new NotFoundException();
    const link = await tx.vendorExhibition.findFirst({ where: { vendorId, exhibitionId: form.exhibitionId, organizationId } });
    if (!link) throw new NotFoundException();
    return form;
  }

  private async ensureReturn(tx: Tx, organizationId: string, exhibitionFormId: string, vendorId: string) {
    const existing = await tx.exhibitionFormReturn.findFirst({ where: { exhibitionFormId, vendorId, organizationId } });
    if (existing) return existing;
    return tx.exhibitionFormReturn.create({ data: { organizationId, exhibitionFormId, vendorId } });
  }

  private async store(user: AuthContext, file: Upload | undefined, options: { pdfOnly: boolean; keyPrefix: string }) {
    if (!file?.buffer?.length) throw new ConflictException("Choose a file to upload.");
    const limit = await this.tenant.transaction(user.organizationId, async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: user.organizationId }, select: { settings: true } });
      return effectiveSettings(parseStored(organization?.settings)).maxUploadBytes;
    });
    if (file.size > limit) throw new ConflictException("The file is larger than the allowed limit.");
    const filename = file.originalname.replace(/[^\w.\- ]+/g, "_").slice(0, 180) || "upload.pdf";
    if (options.pdfOnly && !filename.toLowerCase().endsWith(".pdf")) throw new ConflictException("Upload a PDF.");
    const mimeType = options.pdfOnly ? "application/pdf" : mimeForFilename(filename, file.mimetype || "");
    const scan = await scanBuffer(file.buffer, filename, mimeType, { host: env().CLAMAV_HOST, port: env().CLAMAV_PORT });
    if (!scan.clean) throw new ConflictException(scan.details || "This file was rejected.");
    const storageKey = `${options.keyPrefix}/${randomUUID()}`;
    await this.storage.put(user.organizationId, storageKey, file.buffer, mimeType);
    return {
      storageKey,
      filename,
      mimeType,
      sizeBytes: file.size,
      checksum: createHash("sha256").update(file.buffer).digest("hex"),
    };
  }

  private async readStored(organizationId: string, storageKey: string, filename: string, mimeType: string) {
    const bytes = await this.storage.get(organizationId, storageKey);
    return { bytes, filename: filename.replace(/["\r\n]/g, ""), mimeType: mimeType || "application/pdf" };
  }

  private async mailVendors(tx: Tx, organizationId: string, exhibitionId: string, message: { subject: string; title: string; text: string }) {
    const links = await tx.vendorExhibition.findMany({
      where: { organizationId, exhibitionId, vendor: { archivedAt: null } },
      select: { vendor: { select: { id: true, email: true, users: { select: { id: true }, take: 1 } } } },
    });
    for (const link of links) {
      await this.mailOne(tx, organizationId, link.vendor, { ...message, idempotencyKey: `packet-added:${exhibitionId}:${link.vendor.id}:${randomUUID()}` });
    }
  }

  private async mailOne(
    tx: Tx,
    organizationId: string,
    vendor: { email: string; users?: { id: string }[] },
    message: { subject: string; title: string; text: string; idempotencyKey: string },
  ) {
    const link = `${env().WEB_ORIGIN.replace(/\/$/, "")}/vendor`;
    await this.outbox.enqueue(tx, {
      organizationId,
      type: "email.packet",
      idempotencyKey: message.idempotencyKey,
      payload: {
        to: vendor.email,
        userId: vendor.users?.[0]?.id,
        template: "packet",
        audience: "vendor",
        subject: message.subject,
        title: message.title,
        text: message.text,
        link: "/vendor",
        actionUrl: link,
        idempotencyKey: message.idempotencyKey,
      },
    });
  }

  private async flush() {
    if (env().JOBS_MODE === "inline") await this.processor.flush(20);
  }
}

function viewStatus(status: string, uploadedAt: Date | null | undefined, requestedAt: Date | null | undefined, hasFile: boolean) {
  if (status === "REUPLOAD" && hasFile && replacedAfter(uploadedAt ?? null, requestedAt ?? null)) return "READY";
  return status;
}

function replacedAfter(uploadedAt: Date | null, requestedAt: Date | null) {
  if (!uploadedAt || !requestedAt) return false;
  return uploadedAt.getTime() > requestedAt.getTime();
}
