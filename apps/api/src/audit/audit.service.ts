import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { currentContext } from "../common/context";
import type { Tx } from "../prisma/prisma.service";

export type AuditInput = {
  organizationId: string;
  actorId?: string | null;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  vendorId?: string | null;
  fieldId?: string | null;
  previousValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
};

@Injectable()
export class AuditService {
  async record(tx: Tx, input: AuditInput) {
    const context = currentContext();
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? "",
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        vendorId: input.vendorId ?? null,
        fieldId: input.fieldId ?? null,
        previousValue: input.previousValue ?? undefined,
        newValue: input.newValue ?? undefined,
        correlationId: context.correlationId,
        ip: context.ip ?? null,
      },
    });
  }
}
