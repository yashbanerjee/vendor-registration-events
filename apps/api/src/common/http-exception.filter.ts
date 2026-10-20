import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FormValidationError, LockedFieldError, WorkflowError } from "@vmp/shared";
import type { Response } from "express";
import { ZodError } from "zod";
import { currentContext } from "./context";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const correlationId = currentContext().correlationId;
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Something went wrong.";
    let details: unknown;
    let code = "INTERNAL";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") message = body;
      else if (body && typeof body === "object") {
        const record = body as Record<string, unknown>;
        message = typeof record.message === "string" ? record.message : message;
        if (Array.isArray(record.message)) message = record.message.join(" ");
        details = record.details;
        code = typeof record.code === "string" ? record.code : codeForStatus(status);
        if (typeof record.fieldId === "string") details = { fieldId: record.fieldId };
      }
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = "VALIDATION";
      message = "The request is invalid.";
      details = exception.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
    } else if (exception instanceof FormValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = "FORM_INVALID";
      message = "The form has validation errors.";
      details = exception.issues;
    } else if (exception instanceof LockedFieldError) {
      status = HttpStatus.CONFLICT;
      code = "FIELD_LOCKED";
      message = "A locked field was modified.";
      details = { fieldId: exception.fieldId };
    } else if (exception instanceof WorkflowError) {
      status = HttpStatus.CONFLICT;
      code = "WORKFLOW";
      message = exception.message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === "P2002") {
      status = HttpStatus.CONFLICT;
      code = "CONFLICT";
      message = "A record with these unique values already exists.";
    } else if (exception && typeof exception === "object" && "status" in exception && (exception as { status: number }).status === 429) {
      status = 429;
      code = "RATE_LIMITED";
      message = exception instanceof Error ? exception.message : message;
    } else {
      const detail = exception instanceof Error ? exception.stack ?? exception.message : "Unhandled error";
      this.logger.error(detail);
      console.error(detail);
    }

    response.status(status).json({
      error: { code, message, details, correlationId },
    });
  }
}

function codeForStatus(status: number): string {
  if (status === 400) return "VALIDATION";
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  return "HTTP_ERROR";
}
