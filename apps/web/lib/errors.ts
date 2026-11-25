type ApiLikeError = {
  name?: string;
  message?: string;
  status?: number;
  code?: string;
};

/**
 * Vendor-facing errors: never show raw API / server text.
 * Always return plain language based on status, or the provided fallback.
 */
export function vendorErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (isApiLikeError(error)) {
    const status = error.status ?? 0;
    const code = (error.code || "").toUpperCase();
    const raw = (error.message || "").trim();
    if (code === "NETWORK" || status === 0) {
      if (/aborted|AbortError/i.test(raw)) return "The upload was cancelled. Please try again.";
      return "Could not reach the server. Check your internet connection and try again.";
    }
    if (code === "UPLOAD_ABORTED") return "The upload was cancelled. Please try again.";
    if (status === 401) return "Your session has expired. Please sign in again.";
    if (status === 403) return "You do not have permission for this action.";
    if (status === 404) return "That item was not found.";
    if (status === 413 || code === "UPLOAD_LIMIT") return "That file is too large. Choose a smaller file and try again.";
    if (status === 429 || code === "RATE_LIMITED") return "Too many requests were sent. Please wait a moment and try again.";
    if (code === "STORAGE") return "The file could not be saved. Please try again.";
    if (status === 409 || code === "CONFLICT" || code === "FORM_INVALID" || code === "FIELD_LOCKED" || code === "WORKFLOW") {
      return raw && isHumanMessage(raw) ? raw : "This action could not be completed. Please check the file and try again.";
    }
    if (status === 400 || code === "VALIDATION") {
      return raw && isHumanMessage(raw) ? raw : "Please check your file and try again.";
    }
    if (status >= 500 || code === "INVALID_JSON") {
      return "Something went wrong while uploading. Please try again.";
    }
    return raw && isHumanMessage(raw) ? raw : fallback;
  }
  if (error instanceof Error && /aborted|AbortError/i.test(error.message)) {
    return "The upload was cancelled. Please try again.";
  }
  return fallback;
}

/** Field-level copy for vendors: keep short human text, replace technical API text. */
export function vendorFieldMessage(message: unknown, fallback = "Please check this field and try again.") {
  if (typeof message !== "string") return fallback;
  const value = message.trim();
  if (!value) return fallback;
  if (!isHumanMessage(value) || looksTechnical(value) || looksLikeApiPayload(value)) return fallback;
  return value;
}

export function friendlyErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (isApiLikeError(error)) return messageForApiError(error, fallback);
  if (error instanceof Error && error.message.trim()) {
    if (/aborted|AbortError/i.test(error.message)) return "The upload was cancelled. Please try again.";
    return isHumanMessage(error.message) ? error.message.trim() : fallback;
  }
  if (typeof error === "string" && error.trim()) {
    return isHumanMessage(error) ? error.trim() : fallback;
  }
  return fallback;
}

function isApiLikeError(error: unknown): error is ApiLikeError {
  if (!error || typeof error !== "object") return false;
  const value = error as ApiLikeError;
  return value.name === "ApiError" || typeof value.status === "number";
}

function messageForApiError(error: ApiLikeError, fallback: string) {
  const raw = (error.message || "").trim();
  const status = error.status ?? 0;
  const code = (error.code || "").toUpperCase();

  if (code === "NETWORK" || status === 0) {
    if (/aborted|AbortError/i.test(raw)) return "The upload was cancelled. Please try again.";
    return "Could not reach the server. Check your internet connection and try again.";
  }
  if (code === "UPLOAD_ABORTED") return "The upload was cancelled. Please try again.";
  if (code === "INVALID_JSON" || looksTechnical(raw) || looksLikeApiPayload(raw) || /^Internal Server Error$/i.test(raw)) {
    return "Something went wrong while uploading. Please try again.";
  }
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return raw && isHumanMessage(raw) ? raw : "You do not have permission for this action.";
  if (status === 404) return raw && isHumanMessage(raw) ? raw : "That item was not found.";
  if (status === 413 || code === "UPLOAD_LIMIT") {
    return raw && isHumanMessage(raw) ? raw : "That file is too large. Choose a smaller file and try again.";
  }
  if (status === 429 || code === "RATE_LIMITED") {
    return "Too many requests were sent. Please wait a moment and try again.";
  }
  if (code === "STORAGE" || /could not be stored|file storage|storage bucket|storage credentials/i.test(raw)) {
    return "The file could not be saved. Please try again.";
  }
  if (status === 409 || code === "CONFLICT" || code === "WORKFLOW" || code === "FORM_INVALID" || code === "FIELD_LOCKED") {
    return raw && isHumanMessage(raw) && !looksLikeApiPayload(raw) ? raw : "This action could not be completed. Refresh the page and try again.";
  }
  if (status === 400 || code === "VALIDATION") {
    return raw && isHumanMessage(raw) ? raw : "Please check your file and try again.";
  }
  if (status >= 500) {
    return "Something went wrong while uploading. Please try again.";
  }
  if (raw && isHumanMessage(raw) && !looksLikeApiPayload(raw)) return raw;
  return fallback;
}

function looksTechnical(message: string) {
  return /Unexpected token|not valid JSON|XML parse|mismatched tags|ECONNREFUSED|ENOTFOUND|fetch failed|<!DOCTYPE|<html|<hr>|at\s+\w+\s+\(|Deserialization error|stack trace|Prisma|NestJS|Exception|TypeError|ReferenceError|Cannot read propert|ECONNRESET|socket hang up|postgres|sqlstate/i.test(message);
}

function looksLikeApiPayload(message: string) {
  return /^\{[\s\S]*\}$/.test(message)
    || /^\[error\]/i.test(message)
    || /\b(statusCode|correlationId|stack|traceId|requestId)\b/i.test(message)
    || /^Error:\s/i.test(message)
    || /https?:\/\/\S+/i.test(message) && /api\/v1|\.json\b/i.test(message);
}

function isHumanMessage(message: string) {
  const value = message.trim();
  if (!value) return false;
  if (value.length > 220) return false;
  if (looksTechnical(value)) return false;
  if (looksLikeApiPayload(value)) return false;
  return true;
}
