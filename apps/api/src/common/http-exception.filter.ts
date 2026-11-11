import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Inject, Logger, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FormValidationError, LockedFieldError, WorkflowError } from "@vmp/shared";
import type { Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import type { AuthContext } from "./auth";
import { currentContext } from "./context";
import { ErrorReportsService } from "../platform/error-reports.service";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(@Optional() @Inject(ErrorReportsService) private readonly reports?: ErrorReportsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { user?: AuthContext }>();
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
    } else if (exception instanceof MulterError) {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      code = "UPLOAD_LIMIT";
      message = exception.code === "LIMIT_FILE_SIZE" ? "The file is larger than the allowed limit." : "The file upload was rejected.";
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
      if (exception instanceof Error && /storage|S3|bucket|Railway storage/i.test(exception.message)) {
        message = exception.message;
        code = "STORAGE";
      }
    }

    response.status(status).json({
      error: { code, message, details, correlationId },
    });

    const shouldReport =
      Boolean(request.user?.organizationId) &&
      (status >= 500 || isUploadPath(request.method, request.originalUrl || request.url) || code === "STORAGE" || code === "UPLOAD_LIMIT");
    if (shouldReport && this.reports) {
      void this.reports.record({
        organizationId: request.user!.organizationId,
        user: request.user!,
        source: isUploadPath(request.method, request.originalUrl || request.url) ? "upload" : "api",
        method: request.method,
        path: (request.originalUrl || request.url || "").slice(0, 500),
        statusCode: status,
        code,
        message,
        details: details ?? (exception instanceof Error ? { name: exception.name, error: exception.message } : undefined),
        correlationId,
        userAgent: request.header("user-agent")?.slice(0, 500),
      });
    }
  }
}

function codeForStatus(status: number): string {
  if (status === 400) return "VALIDATION";
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 413) return "UPLOAD_LIMIT";
  if (status === 429) return "RATE_LIMITED";
  return "HTTP_ERROR";
}

function isUploadPath(method: string, url: string) {
  if (method.toUpperCase() !== "POST" && method.toUpperCase() !== "PUT") return false;
  return /\/documents\b|\/imports\b|\/packets\b|\/forms\/.+\/assets\b|\/exhibition-forms\b/i.test(url);
}
