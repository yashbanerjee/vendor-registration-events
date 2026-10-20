import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FormValidationError, LockedFieldError, WorkflowError } from "@vmp/shared";

export function mapDomainError(error: unknown): never {
  if (error instanceof FormValidationError) {
    throw new ConflictException({
      message: "The form has validation errors.",
      details: error.issues,
      code: "FORM_INVALID",
    });
  }
  if (error instanceof LockedFieldError) {
    throw new ConflictException({
      message: "One or more locked fields were modified.",
      fieldId: error.fieldId,
      code: "FIELD_LOCKED",
    });
  }
  if (error instanceof WorkflowError) {
    throw new ConflictException({ message: error.message, code: "WORKFLOW" });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ConflictException({ message: "A record with these unique values already exists.", code: "CONFLICT" });
    }
    if (error.code === "P2025") throw new NotFoundException();
  }
  throw error;
}

const hits = new Map<string, number[]>();

export function assertRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    const error = new Error("Too many attempts. Try again later.");
    (error as Error & { status: number }).status = 429;
    throw error;
  }
  recent.push(now);
  hits.set(key, recent);
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

export function decodeCursor(cursor?: string): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
