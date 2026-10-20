import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  assertLockedFieldsUnchanged,
  assertTransition,
  collectDocumentIds,
  formSchemaDefinition,
  isReviewable,
  validateSubmission,
  type AssignmentStatus,
  type FormSchemaDefinition,
} from "@vmp/shared";
import { z } from "zod";
import type { AuthContext } from "../common/auth";
import { randomToken, sha256 } from "../common/crypto";
import { decodeCursor, encodeCursor } from "../common/http";
import { env } from "../config/env";
import { AuditService } from "../audit/audit.service";
import { OutboxService } from "../jobs/jobs.service";
import { effectiveSettings, parseStored } from "../platform/org-settings";
import { TenantService, type Tx } from "../prisma/prisma.service";

const assignSchema = z.object({
  vendorId: z.string().uuid(),
  exhibitionId: z.string().uuid(),
  formVersionId: z.string().uuid(),
  deadline: z.string().datetime().optional(),
});

const valuesSchema = z.object({
  lockVersion: z.number().int().nonnegative(),
  values: z.record(z.unknown()),
});

const correctionSchema = z.object({
  lockVersion: z.number().int().nonnegative(),
  fields: z.array(z.object({ fieldId: z.string().uuid(), note: z.string().min(3).max(2000) })).min(1).max(100),
});

@Injectable()
export class WorkflowService {
  constructor(
    @Inject(TenantService) private readonly tenant: TenantService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
  ) {}

  async list(user: AuthContext, query: { cursor?: string; status?: string; q?: string; limit?: string }) {
    this.assertCanRead(user);
    const limit = Math.min(Number(query.limit ?? 25) || 25, 100);
    const cursor = decodeCursor(query.cursor);
    const filters: object[] = [];
    if (query.q) {
      filters.push({
        OR: [
          { vendor: { companyName: { contains: query.q, mode: "insensitive" } } },
          { exhibition: { name: { contains: query.q, mode: "insensitive" } } },
          { formVersion: { template: { name: { contains: query.q, mode: "insensitive" } } } },
        ],
      });
    }
    if (cursor) {
      filters.push({
        OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }],
      });
    }
    const rows = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.formAssignment.findMany({
        where: {
          organizationId: user.organizationId,
          ...(user.vendorId ? { vendorId: user.vendorId } : {}),
          ...(query.status ? { status: query.status as AssignmentStatus } : {}),
          ...(filters.length ? { AND: filters } : {}),
        },
        include: assignmentInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      }),
    );
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      data: page.map((row) => this.present(row, Boolean(user.vendorId))),
      nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async get(user: AuthContext, id: string) {
    const row = await this.tenant.transaction(user.organizationId, (tx) => this.load(tx, user, id));
    return { data: this.present(row, Boolean(user.vendorId)) };
  }

  async assign(user: AuthContext, body: unknown) {
    const input = assignSchema.parse(body);
    const data = await this.tenant.transaction(user.organizationId, (tx) => this.createAssignment(tx, user, input));
    return this.get(user, data);
  }

  async assignMany(user: AuthContext, body: unknown) {
    const input = z.object({
      vendorIds: z.array(z.string().uuid()).min(1).max(500),
      exhibitionId: z.string().uuid(),
      formVersionId: z.string().uuid(),
    }).parse(body);
    const assigned = await this.tenant.transaction(user.organizationId, async (tx) => {
      for (const vendorId of input.vendorIds) {
        await this.createAssignment(tx, user, {
          vendorId,
          exhibitionId: input.exhibitionId,
          formVersionId: input.formVersionId,
        });
      }
      return input.vendorIds.length;
    });
    return { data: { assigned } };
  }

  async createAssignment(tx: Tx, user: AuthContext, input: z.infer<typeof assignSchema>) {
    const [vendor, exhibition, version] = await Promise.all([
      tx.vendor.findFirst({
        where: { id: input.vendorId, organizationId: user.organizationId, archivedAt: null },
        include: { users: { select: { id: true } } },
      }),
      tx.exhibition.findFirst({ where: { id: input.exhibitionId, organizationId: user.organizationId } }),
      tx.formVersion.findFirst({
        where: { id: input.formVersionId, organizationId: user.organizationId },
        include: { template: true },
      }),
    ]);
    if (!vendor || !exhibition || !version) throw new NotFoundException("Vendor, exhibition, or form version was not found.");
    if (version.template.archivedAt) throw new ConflictException("This form is archived.");
    const assignment = await tx.formAssignment.create({
      data: {
        organizationId: user.organizationId,
        vendorId: vendor.id,
        exhibitionId: exhibition.id,
        formVersionId: version.id,
        deadline: input.deadline ? new Date(input.deadline) : null,
        createdById: user.id,
        status: "INVITED",
      },
    });
    await tx.vendorExhibition.upsert({
      where: { vendorId_exhibitionId: { vendorId: vendor.id, exhibitionId: exhibition.id } },
      update: {},
      create: { organizationId: user.organizationId, vendorId: vendor.id, exhibitionId: exhibition.id },
    });
    await this.issueInvitation(tx, user, {
      vendor,
      assignmentId: assignment.id,
      purpose: "FORM_ASSIGNMENT",
      subject: `Complete ${version.template.name} for ${exhibition.name}`,
      intro: `${user.name} assigned ${version.template.name} for ${exhibition.name}.`,
    });
    await this.audit.record(tx, {
      organizationId: user.organizationId,
      actorId: user.id,
      actorRole: user.roles.join(","),
      action: "assignment.created",
      resourceType: "assignment",
      resourceId: assignment.id,
      vendorId: vendor.id,
      newValue: { formVersionId: version.id, exhibitionId: exhibition.id },
    });
    return assignment.id;
  }

  async resend(user: AuthContext, id: string) {
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const assignment = await this.load(tx, user, id);
      if (["APPROVED", "REVOKED", "REJECTED"].includes(assignment.status)) {
        throw new ConflictException("This assignment can no longer be re-invited.");
      }
      const purpose = assignment.status === "CORRECTION_REQUESTED" ? "CORRECTION" : "FORM_ASSIGNMENT";
      await this.issueInvitation(tx, user, {
        vendor: assignment.vendor,
        assignmentId: assignment.id,
        purpose,
        subject: purpose === "CORRECTION" ? `Corrections requested for ${assignment.formVersion.template.name}` : `Reminder: ${assignment.formVersion.template.name}`,
        intro: purpose === "CORRECTION" ? "Some answers need to be corrected." : "This is a reminder to complete your assigned form.",
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "invitation.resent",
        resourceType: "assignment",
        resourceId: id,
        vendorId: assignment.vendorId,
      });
    });
    return this.get(user, id);
  }

  async replaceForm(user: AuthContext, id: string, body: unknown) {
    const input = z.object({ formVersionId: z.string().uuid() }).parse(body);
    const assignmentId = await this.tenant.transaction(user.organizationId, async (tx) => {
      const assignment = await this.load(tx, user, id);
      if (assignment.status === "APPROVED" || assignment.status === "REVOKED") {
        throw new ConflictException("This form can no longer be changed.");
      }
      const version = await tx.formVersion.findFirst({
        where: { id: input.formVersionId, organizationId: user.organizationId },
        include: { template: true },
      });
      if (!version || version.template.archivedAt) throw new NotFoundException("That published form was not found.");
      if (assignment.status === "INVITED" && !assignment.submission) {
        await tx.formAssignment.update({
          where: { id },
          data: { formVersionId: version.id, lockVersion: { increment: 1 } },
        });
        await this.issueInvitation(tx, user, {
          vendor: assignment.vendor,
          assignmentId: id,
          purpose: "FORM_ASSIGNMENT",
          subject: `Complete ${version.template.name} for ${assignment.exhibition.name}`,
          intro: `${user.name} changed the assigned form to ${version.template.name} for ${assignment.exhibition.name}.`,
        });
        await this.audit.record(tx, {
          organizationId: user.organizationId,
          actorId: user.id,
          actorRole: user.roles.join(","),
          action: "assignment.form_changed",
          resourceType: "assignment",
          resourceId: id,
          vendorId: assignment.vendorId,
          newValue: { formVersionId: version.id },
        });
        return id;
      }
      await tx.invitation.updateMany({
        where: { assignmentId: id, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.formAssignment.update({
        where: { id },
        data: { status: "REVOKED", lockVersion: { increment: 1 } },
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "assignment.replaced",
        resourceType: "assignment",
        resourceId: id,
        vendorId: assignment.vendorId,
        newValue: { formVersionId: version.id },
      });
      return this.createAssignment(tx, user, {
        vendorId: assignment.vendorId,
        exhibitionId: assignment.exhibitionId,
        formVersionId: version.id,
      });
    });
    return this.get(user, assignmentId);
  }

  async revoke(user: AuthContext, id: string) {
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const assignment = await this.load(tx, user, id);
      assertTransition(assignment.status, "REVOKED");
      await tx.formAssignment.update({ where: { id }, data: { status: "REVOKED", lockVersion: { increment: 1 } } });
      await tx.invitation.updateMany({
        where: { assignmentId: id, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "assignment.revoked",
        resourceType: "assignment",
        resourceId: id,
        vendorId: assignment.vendorId,
      });
    });
    return this.get(user, id);
  }

  async saveDraft(user: AuthContext, id: string, body: unknown) {
    const input = valuesSchema.parse(body);
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const assignment = await this.load(tx, user, id);
      this.assertVendorActor(user, assignment.vendorId);
      if (assignment.status !== "INVITED" && assignment.status !== "IN_PROGRESS") {
        throw new ConflictException("This form is not open for editing.");
      }
      if (assignment.status === "INVITED") assertTransition(assignment.status, "IN_PROGRESS");
      const submission = await this.ensureSubmission(tx, assignment.organizationId, assignment.id);
      await this.appendRevision(tx, assignment, submission.id, input.values, user.id);
      const updated = await tx.formAssignment.updateMany({
        where: { id, lockVersion: input.lockVersion, status: assignment.status },
        data: { status: "IN_PROGRESS", lockVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException("This record was updated by someone else. Reload and try again.");
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "submission.draft_saved",
        resourceType: "assignment",
        resourceId: id,
        vendorId: assignment.vendorId,
      });
    });
    return this.get(user, id);
  }

  async submit(user: AuthContext, id: string, body: unknown) {
    const input = valuesSchema.parse(body);
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const assignment = await this.load(tx, user, id);
      this.assertVendorActor(user, assignment.vendorId);
      const correcting = assignment.status === "CORRECTION_REQUESTED";
      const next = correcting ? "RESUBMITTED_PENDING_REVIEW" : "SUBMITTED_PENDING_REVIEW";
      assertTransition(assignment.status, next);
      const schema = formSchemaDefinition.parse(assignment.formVersion.schema);
      const previous = this.currentValues(assignment);
      let storedValues = input.values;
      if (correcting) {
        const open = assignment.submission?.corrections[0];
        if (!open) throw new ConflictException("There is no open correction request.");
        const editable = new Set(open.fields.map((field) => field.fieldId));
        assertLockedFieldsUnchanged({ fields: schema.fields, previous, next: input.values, editableFieldIds: editable });
        validateSubmission({ schema, values: input.values, editableFieldIds: editable });
        storedValues = input.values;
        await tx.correctionRequest.update({
          where: { id: open.id },
          data: { status: "RESOLVED", resolvedAt: new Date() },
        });
      } else {
        if (assignment.status !== "IN_PROGRESS" && assignment.status !== "INVITED") {
          throw new ConflictException("This form cannot be submitted from its current state.");
        }
        validateSubmission({ schema, values: input.values });
      }
      await this.assertDocuments(tx, assignment, schema, storedValues);
      const submission = await this.ensureSubmission(tx, assignment.organizationId, assignment.id);
      const revision = await this.appendRevision(tx, assignment, submission.id, storedValues, user.id);
      await tx.document.updateMany({
        where: { organizationId: assignment.organizationId, vendorId: assignment.vendorId, assignmentId: assignment.id },
        data: { submissionRevisionId: revision.id },
      });
      const updated = await tx.formAssignment.updateMany({
        where: { id, lockVersion: input.lockVersion, status: assignment.status },
        data: {
          status: next,
          lockVersion: { increment: 1 },
          submittedAt: new Date(),
        },
      });
      if (updated.count !== 1) throw new ConflictException("This record was updated by someone else. Reload and try again.");
      await this.notifyReviewers(tx, user.organizationId, {
        idempotencyKey: `submission:${revision.id}`,
        subject: correcting ? `Resubmission from ${assignment.vendor.companyName}` : `Submission from ${assignment.vendor.companyName}`,
        text: `${assignment.vendor.companyName} ${correcting ? "resubmitted" : "submitted"} ${assignment.formVersion.template.name} for ${assignment.exhibition.name}.`,
        link: `/admin/reviews/${assignment.id}`,
        vendorEmail: assignment.vendor.email,
        vendorUserId: assignment.vendor.users[0]?.id,
        vendorText: correcting
          ? `Your corrections for ${assignment.formVersion.template.name} were received and are waiting for review.`
          : `We received your submission for ${assignment.formVersion.template.name}. It is waiting for review.`,
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: correcting ? "submission.resubmitted" : "submission.submitted",
        resourceType: "submission_revision",
        resourceId: revision.id,
        vendorId: assignment.vendorId,
        newValue: { assignmentId: id, revisionNumber: revision.revisionNumber },
      });
    });
    return this.get(user, id);
  }

  async requestCorrection(user: AuthContext, id: string, body: unknown) {
    const input = correctionSchema.parse(body);
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const assignment = await this.load(tx, user, id);
      if (!isReviewable(assignment.status)) throw new ConflictException("This submission is not waiting for review.");
      const schema = formSchemaDefinition.parse(assignment.formVersion.schema);
      const known = new Set(schema.fields.filter((field) => field.type !== "heading" && field.type !== "info").map((field) => field.id));
      for (const field of input.fields) {
        if (!known.has(field.fieldId)) throw new ConflictException("A selected field is not part of this form version.");
      }
      assertTransition(assignment.status, "CORRECTION_REQUESTED");
      const revisionId = assignment.submission?.currentRevisionId;
      if (!revisionId || !assignment.submission) throw new ConflictException("There is no submission to correct.");
      await tx.correctionRequest.updateMany({
        where: { submissionId: assignment.submission.id, status: "OPEN" },
        data: { status: "SUPERSEDED", resolvedAt: new Date() },
      });
      const correction = await tx.correctionRequest.create({
        data: {
          organizationId: user.organizationId,
          submissionId: assignment.submission.id,
          revisionId,
          requestedById: user.id,
          fields: {
            create: input.fields.map((field) => ({
              organizationId: user.organizationId,
              fieldId: field.fieldId,
              note: field.note,
            })),
          },
        },
      });
      const updated = await tx.formAssignment.updateMany({
        where: { id, lockVersion: input.lockVersion, status: assignment.status },
        data: { status: "CORRECTION_REQUESTED", lockVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException("This record was updated by someone else. Reload and try again.");
      const labels = input.fields
        .map((field, index) => {
          const match = schema.fields.find((item) => item.id === field.fieldId);
          return `${index + 1}. ${match?.label ?? field.fieldId}\nComment: ${field.note}`;
        })
        .join("\n\n");
      await this.issueInvitation(tx, user, {
        vendor: assignment.vendor,
        assignmentId: assignment.id,
        purpose: "CORRECTION",
        subject: `Update ${input.fields.length} field${input.fields.length === 1 ? "" : "s"} on ${assignment.formVersion.template.name}`,
        intro: `Please update only these fields. The rest of your submission stays locked.\n\n${labels}`,
        notifyAdmins: false,
      });
      for (const field of input.fields) {
        await this.audit.record(tx, {
          organizationId: user.organizationId,
          actorId: user.id,
          actorRole: user.roles.join(","),
          action: "correction.requested",
          resourceType: "correction_request",
          resourceId: correction.id,
          vendorId: assignment.vendorId,
          fieldId: field.fieldId,
          newValue: { note: field.note },
        });
      }
    });
    return this.get(user, id);
  }

  async approve(user: AuthContext, id: string, body: unknown) {
    const input = z.object({ lockVersion: z.number().int().nonnegative() }).parse(body);
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const assignment = await this.load(tx, user, id);
      if (!isReviewable(assignment.status)) throw new ConflictException("This submission is not waiting for approval.");
      const revisionId = assignment.submission?.currentRevisionId;
      if (!revisionId) throw new ConflictException("There is no revision to approve.");
      assertTransition(assignment.status, "APPROVED");
      const updated = await tx.formAssignment.updateMany({
        where: { id, lockVersion: input.lockVersion, status: assignment.status },
        data: {
          status: "APPROVED",
          lockVersion: { increment: 1 },
          approvedAt: new Date(),
          approvedById: user.id,
          approvedRevisionId: revisionId,
        },
      });
      if (updated.count !== 1) throw new ConflictException("This record was updated by someone else. Reload and try again.");
      const idempotencyKey = `approval:${revisionId}`;
      const account = assignment.vendor.users[0];
      await this.outbox.enqueue(tx, {
        organizationId: user.organizationId,
        type: "email.approved",
        idempotencyKey,
        payload: {
          to: assignment.vendor.email,
          userId: account?.id,
          template: "approved",
          subject: `${assignment.formVersion.template.name} was approved`,
          title: "Submission approved",
          text: `Your submission for ${assignment.formVersion.template.name} at ${assignment.exhibition.name} was approved. The approved answers are now locked.`,
          link: `/vendor/assignments/${assignment.id}`,
          audience: "vendor",
          idempotencyKey,
        },
      });
      await this.notifyAdmins(tx, user.organizationId, {
        idempotencyKey,
        template: "approved",
        subject: `${assignment.vendor.companyName} was approved`,
        title: "Submission approved",
        text: `${assignment.vendor.companyName} was approved for ${assignment.formVersion.template.name} at ${assignment.exhibition.name}.`,
        link: `/admin/reviews/${assignment.id}`,
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "submission.approved",
        resourceType: "submission_revision",
        resourceId: revisionId,
        vendorId: assignment.vendorId,
        newValue: { assignmentId: id },
      });
    });
    return this.get(user, id);
  }

  async reject(user: AuthContext, id: string, body: unknown) {
    const input = z.object({ lockVersion: z.number().int().nonnegative(), reason: z.string().min(3).max(2000) }).parse(body);
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const assignment = await this.load(tx, user, id);
      if (!isReviewable(assignment.status)) throw new ConflictException("This submission cannot be rejected.");
      assertTransition(assignment.status, "REJECTED");
      const updated = await tx.formAssignment.updateMany({
        where: { id, lockVersion: input.lockVersion, status: assignment.status },
        data: { status: "REJECTED", lockVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException("This record was updated by someone else. Reload and try again.");
      const rejectionKey = `rejection:${id}:${input.lockVersion}`;
      await this.outbox.enqueue(tx, {
        organizationId: user.organizationId,
        type: "email.rejected",
        idempotencyKey: rejectionKey,
        payload: {
          to: assignment.vendor.email,
          userId: assignment.vendor.users[0]?.id,
          template: "rejected",
          audience: "vendor",
          subject: `${assignment.formVersion.template.name} was not approved`,
          title: "Submission not approved",
          text: `Your submission for ${assignment.formVersion.template.name} at ${assignment.exhibition.name} was not approved.\n\n${input.reason}`,
          link: `/vendor/assignments/${assignment.id}`,
          idempotencyKey: rejectionKey,
        },
      });
      await this.notifyAdmins(tx, user.organizationId, {
        idempotencyKey: rejectionKey,
        template: "rejected",
        subject: `${assignment.vendor.companyName} was not approved`,
        title: "Submission not approved",
        text: `${assignment.vendor.companyName} was not approved for ${assignment.formVersion.template.name}.\n\n${input.reason}`,
        link: `/admin/reviews/${assignment.id}`,
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "submission.rejected",
        resourceType: "assignment",
        resourceId: id,
        vendorId: assignment.vendorId,
        newValue: { reason: input.reason },
      });
    });
    return this.get(user, id);
  }

  async addNote(user: AuthContext, id: string, body: unknown) {
    const input = z.object({ body: z.string().min(1).max(4000) }).parse(body);
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const assignment = await this.load(tx, user, id);
      const submission = await this.ensureSubmission(tx, assignment.organizationId, assignment.id);
      await tx.reviewNote.create({
        data: {
          organizationId: user.organizationId,
          submissionId: submission.id,
          authorId: user.id,
          body: input.body,
        },
      });
    });
    return this.get(user, id);
  }

  async reviewQueue(user: AuthContext) {
    const rows = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.formAssignment.findMany({
        where: {
          organizationId: user.organizationId,
          status: { in: ["SUBMITTED_PENDING_REVIEW", "RESUBMITTED_PENDING_REVIEW"] },
        },
        include: assignmentInclude,
        orderBy: { updatedAt: "asc" },
        take: 100,
      }),
    );
    return { data: rows.map((row) => this.present(row, false)) };
  }

  private async issueInvitation(
    tx: Tx,
    user: AuthContext,
    input: {
      vendor: { id: string; email: string; companyName: string; users?: { id: string }[] };
      assignmentId: string;
      purpose: "FORM_ASSIGNMENT" | "CORRECTION";
      subject: string;
      intro: string;
      notifyAdmins?: boolean;
    },
  ) {
    await tx.invitation.updateMany({
      where: { assignmentId: input.assignmentId, purpose: input.purpose, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const organization = await tx.organization.findUnique({ where: { id: user.organizationId }, select: { settings: true } });
    const invitationHours = effectiveSettings(parseStored(organization?.settings)).invitationTtlHours;
    const token = randomToken();
    const invitation = await tx.invitation.create({
      data: {
        organizationId: user.organizationId,
        purpose: input.purpose,
        email: input.vendor.email,
        tokenHash: sha256(token),
        vendorId: input.vendor.id,
        assignmentId: input.assignmentId,
        expiresAt: new Date(Date.now() + invitationHours * 60 * 60 * 1000),
        createdById: user.id,
      },
    });
    const link = `${env().WEB_ORIGIN}/invite/${token}`;
    const idempotencyKey = `invitation:${invitation.id}`;
    await this.outbox.enqueue(tx, {
      organizationId: user.organizationId,
      type: input.purpose === "CORRECTION" ? "email.correction" : "email.invitation",
      idempotencyKey,
      payload: {
        to: input.vendor.email,
        userId: input.vendor.users?.[0]?.id,
        template: input.purpose === "CORRECTION" ? "correction" : "invitation",
        subject: input.subject,
        title: input.subject,
        text: `${input.intro}\n\nOpen this secure link: ${link}\nThe link expires in ${invitationHours} hours and can be used once.`,
        link: `/invite/${token}`,
        actionUrl: link,
        audience: "vendor",
        idempotencyKey,
      },
    });
    if (input.notifyAdmins === false) return;
    await this.notifyAdmins(tx, user.organizationId, {
      idempotencyKey,
      template: input.purpose === "CORRECTION" ? "correction" : "invitation",
      subject: input.purpose === "CORRECTION" ? `Corrections sent to ${input.vendor.companyName}` : `Invitation sent to ${input.vendor.companyName}`,
      title: input.purpose === "CORRECTION" ? "Corrections sent" : "Invitation sent",
      text: `${input.vendor.companyName} (${input.vendor.email}) received this request. The secure link was sent only to the vendor.`,
      link: `/admin/reviews`,
    });
  }

  private async notifyAdmins(
    tx: Tx,
    organizationId: string,
    input: { idempotencyKey: string; template: string; subject: string; title: string; text: string; link: string },
  ) {
    const admins = await tx.user.findMany({
      where: { organizationId, status: "ACTIVE", vendorId: null, roles: { some: { role: { name: "ORG_ADMIN" } } } },
    });
    for (const admin of admins) {
      const key = `${input.idempotencyKey}:admin:${admin.id}`;
      await this.outbox.enqueue(tx, {
        organizationId,
        type: `email.${input.template}`,
        idempotencyKey: key,
        payload: {
          to: admin.email,
          userId: admin.id,
          template: input.template,
          audience: "admin",
          subject: input.subject,
          title: input.title,
          text: input.text,
          link: input.link,
          idempotencyKey: key,
        },
      });
    }
  }

  private async notifyReviewers(
    tx: Tx,
    organizationId: string,
    input: {
      idempotencyKey: string;
      subject: string;
      text: string;
      link: string;
      vendorEmail: string;
      vendorUserId?: string;
      vendorText: string;
    },
  ) {
    const vendorKey = `${input.idempotencyKey}:vendor`;
    await this.outbox.enqueue(tx, {
      organizationId,
      type: "email.submission",
      idempotencyKey: vendorKey,
      payload: {
        to: input.vendorEmail,
        userId: input.vendorUserId,
        template: "submission-ack",
        subject: input.subject,
        title: input.subject,
        text: input.vendorText,
        link: `/vendor/assignments/${input.link.split("/").pop()}`,
        audience: "vendor",
        idempotencyKey: vendorKey,
      },
    });
    const reviewers = await tx.user.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        roles: { some: { role: { permissions: { some: { permission: { key: "submissions.review" } } } } } },
      },
    });
    for (const reviewer of reviewers) {
      const key = `${input.idempotencyKey}:reviewer:${reviewer.id}`;
      await this.outbox.enqueue(tx, {
        organizationId,
        type: "email.submission",
        idempotencyKey: key,
        payload: {
          to: reviewer.email,
          userId: reviewer.id,
          template: "submission-ack",
          subject: input.subject,
          title: input.subject,
          text: input.text,
          link: input.link,
          audience: "admin",
          idempotencyKey: key,
        },
      });
    }
  }

  private async assertDocuments(
    tx: Tx,
    assignment: { id: string; organizationId: string; vendorId: string },
    schema: FormSchemaDefinition,
    values: Record<string, unknown>,
  ) {
    const ids = [...new Set(collectDocumentIds(schema.fields, values))];
    if (!ids.length) return;
    const documents = await tx.document.findMany({
      where: { id: { in: ids }, organizationId: assignment.organizationId, vendorId: assignment.vendorId },
    });
    if (documents.length !== ids.length) throw new ConflictException("A file is missing or belongs to another vendor.");
    for (const document of documents) {
      if (document.status !== "AVAILABLE") throw new ConflictException("A file is still being scanned or was rejected.");
      if (document.assignmentId && document.assignmentId !== assignment.id) {
        throw new ConflictException("A file belongs to another form.");
      }
    }
    await tx.document.updateMany({
      where: { id: { in: ids } },
      data: { assignmentId: assignment.id },
    });
  }

  private async ensureSubmission(tx: Tx, organizationId: string, assignmentId: string) {
    const existing = await tx.submission.findUnique({ where: { assignmentId } });
    if (existing) return existing;
    return tx.submission.create({ data: { organizationId, assignmentId } });
  }

  private async appendRevision(
    tx: Tx,
    assignment: { organizationId: string; formVersionId: string },
    submissionId: string,
    values: Record<string, unknown>,
    actorId: string,
  ) {
    const last = await tx.submissionRevision.findFirst({
      where: { submissionId },
      orderBy: { revisionNumber: "desc" },
    });
    const revision = await tx.submissionRevision.create({
      data: {
        organizationId: assignment.organizationId,
        submissionId,
        formVersionId: assignment.formVersionId,
        revisionNumber: (last?.revisionNumber ?? 0) + 1,
        data: values as object,
        createdById: actorId,
      },
    });
    await tx.submission.update({ where: { id: submissionId }, data: { currentRevisionId: revision.id } });
    return revision;
  }

  private async load(tx: Tx, user: AuthContext, id: string) {
    const assignment = await tx.formAssignment.findFirst({
      where: { id, organizationId: user.organizationId, ...(user.vendorId ? { vendorId: user.vendorId } : {}) },
      include: assignmentInclude,
    });
    if (!assignment) throw new NotFoundException("The assignment was not found.");
    return assignment;
  }

  private assertCanRead(user: AuthContext) {
    if (user.vendorId) return;
    if (!user.permissions.includes("assignments.read") && !user.permissions.includes("submissions.read")) {
      throw new ForbiddenException("You do not have permission for this action.");
    }
  }

  private assertVendorActor(user: AuthContext, vendorId: string) {
    if (!user.vendorId || user.vendorId !== vendorId) {
      throw new ForbiddenException("Only the assigned vendor can edit this form.");
    }
  }

  private currentValues(assignment: { submission: { revisions: { data: unknown }[] } | null }): Record<string, unknown> {
    const data = assignment.submission?.revisions[0]?.data;
    if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
    return {};
  }

  private present(assignment: Awaited<ReturnType<WorkflowService["load"]>>, vendorView: boolean) {
    const schema = formSchemaDefinition.parse(assignment.formVersion.schema);
    const latest = assignment.submission?.revisions[0];
    const open = assignment.submission?.corrections.find((correction) => correction.status === "OPEN") ?? assignment.submission?.corrections[0];
    const editableFieldIds =
      assignment.status === "CORRECTION_REQUESTED"
        ? (open?.fields.map((field) => field.fieldId) ?? [])
        : assignment.status === "INVITED" || assignment.status === "IN_PROGRESS"
          ? schema.fields.filter((field) => field.type !== "heading" && field.type !== "info").map((field) => field.id)
          : [];
    return {
      id: assignment.id,
      status: assignment.status,
      lockVersion: assignment.lockVersion,
      deadline: assignment.deadline,
      submittedAt: assignment.submittedAt,
      approvedAt: assignment.approvedAt,
      approvedRevisionId: assignment.approvedRevisionId,
      vendor: {
        id: assignment.vendor.id,
        reference: assignment.vendor.reference,
        companyName: assignment.vendor.companyName,
        contactName: assignment.vendor.contactName,
        email: assignment.vendor.email,
        phone: assignment.vendor.phone,
        category: assignment.vendor.category,
      },
      exhibition: {
        id: assignment.exhibition.id,
        name: assignment.exhibition.name,
        code: assignment.exhibition.code,
        venue: assignment.exhibition.venue,
        startsAt: assignment.exhibition.startsAt,
        endsAt: assignment.exhibition.endsAt,
      },
      form: {
        templateId: assignment.formVersion.templateId,
        name: assignment.formVersion.template.name,
        versionId: assignment.formVersion.id,
        versionNumber: assignment.formVersion.versionNumber,
        schema,
      },
      values: (latest?.data as Record<string, unknown> | undefined) ?? {},
      revisionNumber: latest?.revisionNumber ?? 0,
      revisions: (assignment.submission?.revisions ?? []).map((revision) => ({
        id: revision.id,
        revisionNumber: revision.revisionNumber,
        createdAt: revision.createdAt,
        createdById: revision.createdById,
      })),
      correction: open
        ? {
            id: open.id,
            status: open.status,
            fields: open.fields.map((field) => ({ fieldId: field.fieldId, note: field.note })),
          }
        : null,
      editableFieldIds,
      notes: vendorView
        ? []
        : (assignment.submission?.notes ?? []).map((note) => ({
            id: note.id,
            body: note.body,
            authorId: note.authorId,
            createdAt: note.createdAt,
          })),
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }
}

const assignmentInclude = {
  vendor: { include: { users: { select: { id: true } } } },
  exhibition: true,
  formVersion: { include: { template: true } },
  submission: {
    include: {
      revisions: { orderBy: { revisionNumber: "desc" as const }, take: 20 },
      corrections: { orderBy: { createdAt: "desc" as const }, include: { fields: true }, take: 10 },
      notes: { orderBy: { createdAt: "desc" as const }, take: 20 },
    },
  },
};
