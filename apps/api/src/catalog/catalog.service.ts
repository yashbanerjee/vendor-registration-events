import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { fieldAnswers, formSchemaDefinition, PERMISSIONS, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { z } from "zod";
import type { AuthContext } from "../common/auth";
import { randomReference } from "../common/crypto";
import { decodeCursor, encodeCursor } from "../common/http";
import { env } from "../config/env";
import { AuditService } from "../audit/audit.service";
import { mimeForFilename, scanBuffer } from "../documents/scan";
import { effectiveSettings, parseStored } from "../platform/org-settings";
import { TenantService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { WorkflowService } from "../workflow/workflow.service";
import { assignVendorCategories, assignVendorCategoryNames, refreshCategoryLabels, UnknownCategoryError } from "./categories";

const vendorFields = z.object({
  reference: z.string().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
  companyName: z.string().min(2).max(200),
  contactName: z.string().min(2).max(200),
  email: z.string().email().max(320),
  additionalEmails: z.array(z.string().email()).max(10).optional(),
  phone: z.string().max(40).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(2).optional(),
  category: z.string().max(120).optional(),
  categoryIds: z.array(z.string().uuid()).max(20).optional(),
  exhibitionIds: z.array(z.string().uuid()).max(50).optional(),
  exhibitionId: z.string().uuid().optional(),
  formVersionId: z.string().uuid().optional(),
});

const vendorSchema = vendorFields.superRefine((value, ctx) => {
  if (Boolean(value.exhibitionId) !== Boolean(value.formVersionId)) {
    ctx.addIssue({
      code: "custom",
      path: ["formVersionId"],
      message: "Choose both an exhibition and a published form so the invitation email can be sent.",
    });
  }
});

const exhibitionSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  venue: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

const vendorPreview = {
  id: true,
  reference: true,
  companyName: true,
  contactName: true,
  email: true,
  phone: true,
  status: true,
  category: true,
} as const;

type VendorPreview = {
  id: string;
  reference: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  status: string;
  category: string;
};

function formProgress(assignment: {
  id: string;
  status: string;
  submittedAt: Date | null;
  formVersion: { versionNumber: number; schema: Prisma.JsonValue; template: { name: string } };
  submission: { revisions: { data: Prisma.JsonValue }[] } | null;
}) {
  const latest = assignment.submission?.revisions[0]?.data;
  const values = latest && typeof latest === "object" && !Array.isArray(latest) ? (latest as Record<string, unknown>) : {};
  const parsed = formSchemaDefinition.safeParse(assignment.formVersion.schema);
  const required = new Set(parsed.success ? parsed.data.fields.filter((field) => field.required).map((field) => field.id) : []);
  const fields = parsed.success ? fieldAnswers(parsed.data, values).map((field) => ({ ...field, required: required.has(field.id) })) : [];
  const requiredFields = fields.filter((field) => field.required);
  return {
    id: assignment.id,
    status: assignment.status,
    submittedAt: assignment.submittedAt,
    form: { name: assignment.formVersion.template.name, versionNumber: assignment.formVersion.versionNumber },
    fields,
    filledCount: fields.filter((field) => field.filled).length,
    fieldCount: fields.length,
    requiredFilled: requiredFields.filter((field) => field.filled).length,
    requiredCount: requiredFields.length,
  };
}

const templateSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(4000).optional(),
  scope: z.enum(["GLOBAL", "EXHIBITION", "VENDOR"]).default("GLOBAL"),
  exhibitionId: z.string().uuid().nullable().optional(),
  vendorId: z.string().uuid().nullable().optional(),
  schema: formSchemaDefinition.optional(),
});

@Injectable()
export class CatalogService {
  constructor(
    @Inject(TenantService) private readonly tenant: TenantService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(WorkflowService) private readonly workflow: WorkflowService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  async listVendors(user: AuthContext, query: { cursor?: string; q?: string; status?: string; limit?: string; categoryId?: string }) {
    const limit = boundedLimit(query.limit);
    const cursor = decodeCursor(query.cursor);
    const categoryId = z.string().uuid().safeParse(query.categoryId).success ? query.categoryId : undefined;
    const rows = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.vendor.findMany({
        where: {
          organizationId: user.organizationId,
          ...(user.vendorId ? { id: user.vendorId } : {}),
          ...(query.status === "ARCHIVED" ? { status: "ARCHIVED" as const } : query.status ? { status: query.status as "ACTIVE", archivedAt: null } : { archivedAt: null }),
          ...(categoryId ? { categories: { some: { categoryId } } } : {}),
          ...(query.q
            ? {
                OR: [
                  { companyName: { contains: query.q, mode: "insensitive" } },
                  { email: { contains: query.q, mode: "insensitive" } },
                  { reference: { contains: query.q, mode: "insensitive" } },
                  { contactName: { contains: query.q, mode: "insensitive" } },
                  { category: { contains: query.q, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(cursor
            ? { AND: [{ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }] }
            : {}),
        },
        include: {
          exhibitions: true,
          categories: { include: { category: { select: { id: true, name: true } } } },
          assignments: {
            where: { status: { not: "REVOKED" } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              exhibitionId: true,
              formVersion: { select: { id: true, versionNumber: true, template: { select: { name: true } } } },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      }),
    );
    return page(rows, limit);
  }

  async getVendor(user: AuthContext, id: string) {
    if (user.vendorId && user.vendorId !== id) throw new NotFoundException();
    const vendor = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.vendor.findFirst({
        where: { id, organizationId: user.organizationId },
        include: {
          exhibitions: { include: { exhibition: true } },
          categories: { include: { category: { select: { id: true, name: true } } } },
          assignments: { include: { exhibition: true, formVersion: { include: { template: true } } }, orderBy: { createdAt: "desc" } },
          documents: { where: { deletedAt: null }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" } },
        },
      }),
    );
    if (!vendor) throw new NotFoundException();
    const addresses = [vendor.email, ...vendor.additionalEmails].map((email) => email.toLowerCase());
    const [audits, emails] = user.vendorId
      ? [[], []]
      : await this.tenant.transaction(user.organizationId, async (tx) => {
          const history = await tx.auditLog.findMany({ where: { organizationId: user.organizationId, vendorId: id }, orderBy: { createdAt: "desc" }, take: 50 });
          const messages = await tx.emailMessage.findMany({
            where: { organizationId: user.organizationId, toAddress: { in: addresses, mode: "insensitive" } },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: { id: true, toAddress: true, template: true, subject: true, status: true, createdAt: true },
          });
          return [history, messages] as const;
        });
    return { data: { ...vendor, audits, emails } };
  }

  async createVendor(user: AuthContext, body: unknown) {
    const input = vendorSchema.parse(body);
    const created = await this.tenant.transaction(user.organizationId, async (tx) => {
      const vendor = await tx.vendor.create({
        data: {
          organizationId: user.organizationId,
          reference: input.reference ?? randomReference(),
          companyName: input.companyName,
          contactName: input.contactName,
          email: input.email.toLowerCase(),
          additionalEmails: (input.additionalEmails ?? []).map((email) => email.toLowerCase()),
          phone: input.phone ?? "",
          addressLine1: input.addressLine1 ?? "",
          addressLine2: input.addressLine2 ?? "",
          city: input.city ?? "",
          region: input.region ?? "",
          postalCode: input.postalCode ?? "",
          country: (input.country ?? "").toUpperCase(),
          category: "",
        },
      });
      await this.applyCategories(tx, user.organizationId, vendor.id, input);
      if (input.exhibitionIds?.length) {
        const exhibitions = await tx.exhibition.findMany({
          where: { organizationId: user.organizationId, id: { in: input.exhibitionIds } },
        });
        if (exhibitions.length !== input.exhibitionIds.length) throw new NotFoundException("An exhibition was not found.");
        await tx.vendorExhibition.createMany({
          data: exhibitions.map((exhibition) => ({
            organizationId: user.organizationId,
            vendorId: vendor.id,
            exhibitionId: exhibition.id,
          })),
        });
      }
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "vendor.created",
        resourceType: "vendor",
        resourceId: vendor.id,
        vendorId: vendor.id,
        newValue: { reference: vendor.reference, email: vendor.email },
      });
      if (input.formVersionId && input.exhibitionId) {
        await this.workflow.createAssignment(tx, user, {
          vendorId: vendor.id,
          exhibitionId: input.exhibitionId,
          formVersionId: input.formVersionId,
        });
      }
      return vendor;
    });
    return { data: created };
  }

  async updateVendor(user: AuthContext, id: string, body: unknown) {
    const input = vendorFields.partial().parse(body);
    const updated = await this.tenant.transaction(user.organizationId, async (tx) => {
      const existing = await tx.vendor.findFirst({ where: { id, organizationId: user.organizationId } });
      if (!existing || existing.archivedAt) throw new NotFoundException();
      const vendor = await tx.vendor.update({
        where: { id },
        data: {
          ...(input.companyName ? { companyName: input.companyName } : {}),
          ...(input.contactName ? { contactName: input.contactName } : {}),
          ...(input.email ? { email: input.email.toLowerCase() } : {}),
          ...(input.additionalEmails ? { additionalEmails: input.additionalEmails.map((email) => email.toLowerCase()) } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
          ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.region !== undefined ? { region: input.region } : {}),
          ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
          ...(input.country !== undefined ? { country: input.country.toUpperCase() } : {}),
          ...(input.reference ? { reference: input.reference } : {}),
        },
      });
      if (input.categoryIds !== undefined || input.category !== undefined) {
        await this.applyCategories(tx, user.organizationId, vendor.id, input);
      }
      if (input.exhibitionIds) {
        await tx.vendorExhibition.deleteMany({ where: { vendorId: id, organizationId: user.organizationId } });
        if (input.exhibitionIds.length) {
          await tx.vendorExhibition.createMany({
            data: input.exhibitionIds.map((exhibitionId) => ({
              organizationId: user.organizationId,
              vendorId: id,
              exhibitionId,
            })),
          });
        }
      }
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "vendor.updated",
        resourceType: "vendor",
        resourceId: id,
        vendorId: id,
      });
      return vendor;
    });
    return { data: updated };
  }

  async archiveVendors(user: AuthContext, body: unknown) {
    const input = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(body);
    const result = await this.tenant.transaction(user.organizationId, async (tx) => {
      const vendors = await tx.vendor.findMany({
        where: { organizationId: user.organizationId, id: { in: input.ids }, archivedAt: null },
      });
      for (const vendor of vendors) {
        await tx.invitation.updateMany({
          where: { vendorId: vendor.id, usedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.vendor.update({
          where: { id: vendor.id },
          data: {
            status: "ARCHIVED",
            archivedAt: new Date(),
            email: `archived+${vendor.id}@invalid.local`,
            reference: `${vendor.reference}-x-${vendor.id.slice(0, 8)}`.slice(0, 80),
          },
        });
        await this.audit.record(tx, {
          organizationId: user.organizationId,
          actorId: user.id,
          actorRole: user.roles.join(","),
          action: "vendor.archived",
          resourceType: "vendor",
          resourceId: vendor.id,
          vendorId: vendor.id,
          newValue: { email: vendor.email },
        });
      }
      return vendors.length;
    });
    return { data: { archived: result } };
  }

  async listCategories(user: AuthContext) {
    const rows = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.vendorCategory.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { name: "asc" },
        include: { _count: { select: { vendors: true } } },
      }),
    );
    return { data: rows };
  }

  async createCategory(user: AuthContext, body: unknown) {
    const input = z.object({ name: z.string().trim().min(2).max(80) }).parse(body);
    const name = input.name.replace(/\s+/g, " ");
    const category = await this.tenant.transaction(user.organizationId, async (tx) => {
      const existing = await tx.vendorCategory.findFirst({
        where: { organizationId: user.organizationId, name: { equals: name, mode: "insensitive" } },
      });
      if (existing) throw new ConflictException("That category already exists.");
      const created = await tx.vendorCategory.create({ data: { organizationId: user.organizationId, name } });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "category.created",
        resourceType: "vendor_category",
        resourceId: created.id,
        newValue: { name },
      });
      return created;
    });
    return { data: category };
  }

  async updateCategory(user: AuthContext, id: string, body: unknown) {
    const input = z.object({ name: z.string().trim().min(2).max(80) }).parse(body);
    const name = input.name.replace(/\s+/g, " ");
    const category = await this.tenant.transaction(user.organizationId, async (tx) => {
      const current = await tx.vendorCategory.findFirst({ where: { id, organizationId: user.organizationId } });
      if (!current) throw new NotFoundException();
      const existing = await tx.vendorCategory.findFirst({
        where: { organizationId: user.organizationId, name: { equals: name, mode: "insensitive" }, NOT: { id } },
      });
      if (existing) throw new ConflictException("That category already exists.");
      const updated = await tx.vendorCategory.update({ where: { id }, data: { name } });
      const links = await tx.vendorCategoryLink.findMany({
        where: { organizationId: user.organizationId, categoryId: id },
        select: { vendorId: true },
      });
      await refreshCategoryLabels(tx, user.organizationId, links.map((link) => link.vendorId));
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "category.updated",
        resourceType: "vendor_category",
        resourceId: id,
        previousValue: { name: current.name },
        newValue: { name },
      });
      return updated;
    });
    return { data: category };
  }

  async deleteCategory(user: AuthContext, id: string) {
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const category = await tx.vendorCategory.findFirst({ where: { id, organizationId: user.organizationId } });
      if (!category) throw new NotFoundException();
      const links = await tx.vendorCategoryLink.findMany({ where: { organizationId: user.organizationId, categoryId: id }, select: { vendorId: true } });
      await tx.vendorCategory.delete({ where: { id } });
      await refreshCategoryLabels(tx, user.organizationId, links.map((link) => link.vendorId));
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "category.deleted",
        resourceType: "vendor_category",
        resourceId: id,
        newValue: { name: category.name },
      });
    });
    return { data: { deleted: true } };
  }

  private async applyCategories(
    tx: Prisma.TransactionClient,
    organizationId: string,
    vendorId: string,
    input: { categoryIds?: string[]; category?: string },
  ) {
    try {
      if (input.categoryIds) {
        await assignVendorCategories(tx, organizationId, vendorId, input.categoryIds);
        return;
      }
      await assignVendorCategoryNames(tx, organizationId, vendorId, (input.category ?? "").split(","));
    } catch (error) {
      if (error instanceof UnknownCategoryError) throw new NotFoundException(error.message);
      throw error;
    }
  }

  async listExhibitions(user: AuthContext) {
    const rows = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.exhibition.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { startsAt: "desc" },
        include: { _count: { select: { vendors: true, assignments: true } } },
      }),
    );
    return { data: rows };
  }

  async getExhibition(user: AuthContext, id: string) {
    if (!z.string().uuid().safeParse(id).success) throw new NotFoundException();
    const loaded = await this.tenant.transaction(user.organizationId, async (tx) => {
      const exhibition = await tx.exhibition.findFirst({ where: { id, organizationId: user.organizationId } });
      if (!exhibition) return null;
      const [links, assignments] = await Promise.all([
        tx.vendorExhibition.findMany({
          where: { organizationId: user.organizationId, exhibitionId: id, vendor: { archivedAt: null } },
          select: { vendor: { select: vendorPreview } },
        }),
        tx.formAssignment.findMany({
          where: { organizationId: user.organizationId, exhibitionId: id, vendor: { archivedAt: null } },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            status: true,
            submittedAt: true,
            vendor: { select: vendorPreview },
            formVersion: { select: { versionNumber: true, schema: true, template: { select: { name: true } } } },
            submission: { select: { revisions: { orderBy: { revisionNumber: "desc" }, take: 1, select: { data: true } } } },
          },
        }),
      ]);
      return { exhibition, links, assignments };
    });
    if (!loaded) throw new NotFoundException();

    const vendors = new Map<string, { vendor: VendorPreview; forms: ReturnType<typeof formProgress>[] }>();
    for (const link of loaded.links) vendors.set(link.vendor.id, { vendor: link.vendor, forms: [] });
    for (const assignment of loaded.assignments) {
      const current = vendors.get(assignment.vendor.id) ?? { vendor: assignment.vendor, forms: [] };
      current.forms.push(formProgress(assignment));
      vendors.set(assignment.vendor.id, current);
    }

    return {
      data: {
        id: loaded.exhibition.id,
        name: loaded.exhibition.name,
        code: loaded.exhibition.code,
        venue: loaded.exhibition.venue,
        description: loaded.exhibition.description,
        startsAt: loaded.exhibition.startsAt,
        endsAt: loaded.exhibition.endsAt,
        status: loaded.exhibition.status,
        vendors: [...vendors.values()]
          .map((entry) => ({
            ...entry.vendor,
            forms: entry.forms.sort((left, right) => Number(left.status === "REVOKED") - Number(right.status === "REVOKED")),
          }))
          .sort((left, right) => left.companyName.localeCompare(right.companyName)),
      },
    };
  }

  async saveExhibition(user: AuthContext, body: unknown, id?: string) {
    const input = exhibitionSchema.parse(body);
    if (new Date(input.endsAt) < new Date(input.startsAt)) throw new ConflictException("The exhibition end is before the start.");
    const saved = await this.tenant.transaction(user.organizationId, async (tx) => {
      const data = {
        name: input.name,
        code: input.code,
        venue: input.venue ?? "",
        description: input.description ?? "",
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        status: input.status ?? "DRAFT",
      };
      let exhibition;
      if (id) {
        const existing = await tx.exhibition.findFirst({ where: { id, organizationId: user.organizationId } });
        if (!existing) throw new NotFoundException();
        exhibition = await tx.exhibition.update({ where: { id }, data });
      } else {
        exhibition = await tx.exhibition.create({ data: { ...data, organizationId: user.organizationId } });
      }
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: id ? "exhibition.updated" : "exhibition.created",
        resourceType: "exhibition",
        resourceId: exhibition.id,
      });
      return exhibition;
    });
    return { data: saved };
  }

  async listForms(user: AuthContext) {
    const rows = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.formTemplate.findMany({
        where: { organizationId: user.organizationId, archivedAt: null },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
        orderBy: { updatedAt: "desc" },
      }),
    );
    return { data: rows };
  }

  async getForm(user: AuthContext, id: string) {
    const form = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.formTemplate.findFirst({
        where: { id, organizationId: user.organizationId },
        include: { versions: { orderBy: { versionNumber: "desc" } } },
      }),
    );
    if (!form) throw new NotFoundException();
    return { data: form };
  }

  async createForm(user: AuthContext, body: unknown) {
    const input = templateSchema.parse(body);
    const schema = input.schema ?? emptySchema();
    const created = await this.tenant.transaction(user.organizationId, async (tx) => {
      const form = await tx.formTemplate.create({
        data: {
          organizationId: user.organizationId,
          name: input.name,
          description: input.description ?? "",
          scope: input.scope,
          exhibitionId: input.exhibitionId ?? null,
          vendorId: input.vendorId ?? null,
          draftSchema: schema as unknown as Prisma.InputJsonValue,
          createdById: user.id,
        },
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "form.created",
        resourceType: "form_template",
        resourceId: form.id,
      });
      return form;
    });
    return { data: created };
  }

  async updateDraft(user: AuthContext, id: string, body: unknown) {
    const input = z.object({
      name: z.string().min(2).max(200).optional(),
      description: z.string().max(4000).optional(),
      scope: z.enum(["GLOBAL", "EXHIBITION", "VENDOR"]).optional(),
      exhibitionId: z.string().uuid().nullable().optional(),
      vendorId: z.string().uuid().nullable().optional(),
      schema: formSchemaDefinition,
    }).parse(body);
    const updated = await this.tenant.transaction(user.organizationId, async (tx) => {
      const existing = await tx.formTemplate.findFirst({ where: { id, organizationId: user.organizationId, archivedAt: null } });
      if (!existing) throw new NotFoundException();
      return tx.formTemplate.update({
        where: { id },
        data: {
          name: input.name ?? existing.name,
          description: input.description ?? existing.description,
          scope: input.scope ?? existing.scope,
          exhibitionId: input.exhibitionId === undefined ? existing.exhibitionId : input.exhibitionId,
          vendorId: input.vendorId === undefined ? existing.vendorId : input.vendorId,
          draftSchema: input.schema as unknown as Prisma.InputJsonValue,
        },
      });
    });
    return { data: updated };
  }

  async publish(user: AuthContext, id: string) {
    const version = await this.tenant.transaction(user.organizationId, async (tx) => {
      const form = await tx.formTemplate.findFirst({ where: { id, organizationId: user.organizationId, archivedAt: null } });
      if (!form) throw new NotFoundException();
      const schema = formSchemaDefinition.parse(form.draftSchema);
      if (!schema.fields.some((field) => field.type !== "heading" && field.type !== "info")) {
        throw new ConflictException("Add at least one input field before publishing.");
      }
      const keys = new Set<string>();
      for (const field of schema.fields) {
        if (keys.has(field.key)) throw new ConflictException(`The internal key ${field.key} is used more than once.`);
        keys.add(field.key);
      }
      const assetIds = reuploadAssetIds(schema.fields);
      if (assetIds.length) {
        const found = await tx.formAsset.findMany({
          where: { organizationId: user.organizationId, id: { in: assetIds } },
          select: { id: true },
        });
        if (found.length !== new Set(assetIds).size) throw new ConflictException("One of the download files is missing. Upload it again.");
      }
      const latest = await tx.formVersion.findFirst({ where: { templateId: id }, orderBy: { versionNumber: "desc" } });
      const created = await tx.formVersion.create({
        data: {
          organizationId: user.organizationId,
          templateId: id,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          schema: schema as unknown as Prisma.InputJsonValue,
          checksum: createHash("sha256").update(JSON.stringify(schema)).digest("hex"),
          publishedById: user.id,
        },
      });
      await tx.formTemplate.update({ where: { id }, data: { status: "PUBLISHED" } });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "form.published",
        resourceType: "form_version",
        resourceId: created.id,
        newValue: { templateId: id, versionNumber: created.versionNumber },
      });
      return created;
    });
    return { data: version };
  }

  async duplicate(user: AuthContext, id: string) {
    const copy = await this.tenant.transaction(user.organizationId, async (tx) => {
      const form = await tx.formTemplate.findFirst({ where: { id, organizationId: user.organizationId } });
      if (!form) throw new NotFoundException();
      return tx.formTemplate.create({
        data: {
          organizationId: user.organizationId,
          name: `${form.name} copy`,
          description: form.description,
          scope: form.scope,
          exhibitionId: form.exhibitionId,
          vendorId: form.vendorId,
          draftSchema: form.draftSchema as object,
          createdById: user.id,
        },
      });
    });
    return { data: copy };
  }

  async compare(user: AuthContext, leftId: string, rightId: string) {
    const versions = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.formVersion.findMany({ where: { organizationId: user.organizationId, id: { in: [leftId, rightId] } } }),
    );
    if (versions.length !== 2) throw new NotFoundException();
    const left = versions.find((version) => version.id === leftId);
    const right = versions.find((version) => version.id === rightId);
    return { data: { left, right } };
  }

  async uploadAsset(
    user: AuthContext,
    templateId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
  ) {
    if (!file?.buffer?.length) throw new ConflictException("Choose a file to upload.");

    const limit = await this.tenant.transaction(user.organizationId, async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: user.organizationId }, select: { settings: true } });
      return effectiveSettings(parseStored(organization?.settings)).maxUploadBytes;
    });
    if (file.size > limit) throw new ConflictException("The file is larger than the allowed limit.");
    const filename = file.originalname.replace(/[^\w.\- ]+/g, "_").slice(0, 180) || "upload";
    const mimeType = mimeForFilename(filename, file.mimetype || "");
    const scan = await scanBuffer(file.buffer, filename, mimeType, { host: env().CLAMAV_HOST, port: env().CLAMAV_PORT });
    if (!scan.clean) throw new ConflictException(scan.details || "This file was rejected.");
    const assetId = randomUUID();
    const storageKey = `org/${user.organizationId}/forms/${templateId}/${assetId}`;
    const saved = await this.tenant.transaction(user.organizationId, async (tx) => {
      const form = await tx.formTemplate.findFirst({ where: { id: templateId, organizationId: user.organizationId, archivedAt: null } });
      if (!form) throw new NotFoundException();
      await this.storage.put(user.organizationId, storageKey, file.buffer, mimeType);
      const asset = await tx.formAsset.create({
        data: {
          id: assetId,
          organizationId: user.organizationId,
          templateId,
          storageKey,
          filename,
          mimeType,
          sizeBytes: file.size,
          checksum: createHash("sha256").update(file.buffer).digest("hex"),
          uploadedById: user.id,
        },
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "form.asset_uploaded",
        resourceType: "form_asset",
        resourceId: asset.id,
        newValue: { templateId, filename, size: file.size },
      });
      return asset;
    });
    return { data: { id: saved.id, filename: saved.filename } };
  }

  async readAsset(user: AuthContext, id: string) {
    const asset = await this.tenant.transaction(user.organizationId, async (tx) => {
      const found = await tx.formAsset.findFirst({ where: { id, organizationId: user.organizationId } });
      if (!found) throw new NotFoundException();
      if (user.vendorId) {
        const assignments = await tx.formAssignment.findMany({
          where: { organizationId: user.organizationId, vendorId: user.vendorId },
          select: { formVersion: { select: { schema: true } } },
        });
        if (!assignments.some((assignment) => schemaReferencesAsset(assignment.formVersion.schema, id))) throw new NotFoundException();
      } else if (![PERMISSIONS.formsRead, PERMISSIONS.formsWrite, PERMISSIONS.documentsRead].some((permission) => user.permissions.includes(permission))) {
        throw new ForbiddenException("You do not have permission for this action.");
      }
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "form.asset_downloaded",
        resourceType: "form_asset",
        resourceId: id,
      });
      return found;
    });
    const bytes = await this.storage.get(user.organizationId, asset.storageKey);
    const mimeType = asset.mimeType === "image/svg+xml" ? "application/octet-stream" : asset.mimeType || "application/octet-stream";
    return { bytes, filename: asset.filename.replace(/["\r\n]/g, ""), mimeType };
  }
}

function reuploadAssetIds(fields: FormField[]): string[] {
  const ids: string[] = [];
  for (const field of fields) {
    if (field.type === "reupload") {
      if (!field.template?.assetId) throw new ConflictException(`${field.label} needs a file for vendors to download.`);
      ids.push(field.template.assetId);
    }
    if (field.children?.length) ids.push(...reuploadAssetIds(field.children));
  }
  return ids;
}

function schemaReferencesAsset(schema: unknown, assetId: string) {
  const parsed = formSchemaDefinition.safeParse(schema);
  if (!parsed.success) return false;
  const walk = (fields: FormField[]): boolean =>
    fields.some((field) => (field.type === "reupload" && field.template?.assetId === assetId) || (field.children ? walk(field.children) : false));
  return walk(parsed.data.fields);
}

function emptySchema(): FormSchemaDefinition {
  return {
    sections: [{ id: randomUUID(), title: "General", description: "", order: 0 }],
    fields: [],
  };
}

function boundedLimit(value?: string) {
  return Math.min(Number(value ?? 25) || 25, 100);
}

function page<T extends { createdAt: Date; id: string }>(rows: T[], limit: number) {
  const slice = rows.slice(0, limit);
  const last = slice.at(-1);
  return { data: slice, nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null };
}
