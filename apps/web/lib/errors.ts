type ApiLikeError = {
  name?: string;
  message?: string;
  status?: number;
  code?: string;
};

export function friendlyErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (isApiLikeError(error)) return messageForApiError(error, fallback);
  if (error instanceof Error && error.message.trim()) {
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
  const code = error.code || "";

  if (code === "NETWORK" || status === 0) {
    return "Could not reach the server. Check your internet connection and try again.";
  }
  if (code === "INVALID_JSON" || looksTechnical(raw) || /^Internal Server Error$/i.test(raw)) {
    return "The server had a problem with this request. Please try again in a moment.";
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
    return raw && isHumanMessage(raw) ? cleanStorageMessage(raw) : "The file could not be saved. Please try again.";
  }
  if (status === 409 || code === "CONFLICT" || code === "WORKFLOW" || code === "FORM_INVALID" || code === "FIELD_LOCKED") {
    return raw && isHumanMessage(raw) ? raw : "This action could not be completed. Refresh the page and try again.";
  }
  if (status >= 500) {
    return raw && isHumanMessage(raw) ? raw : "Something went wrong on the server. Please try again.";
  }
  if (raw && isHumanMessage(raw)) return raw;
  return fallback;
}

function cleanStorageMessage(message: string) {
  return message.replace(/^The file could not be stored\.\s*/i, "").trim() || message;
}

function looksTechnical(message: string) {
  return /Unexpected token|not valid JSON|XML parse|mismatched tags|ECONNREFUSED|ENOTFOUND|fetch failed|<!DOCTYPE|<html|<hr>|at\s+\w+\s+\(|Deserialization error|stack trace/i.test(message);
}

function isHumanMessage(message: string) {
  const value = message.trim();
  if (!value) return false;
  if (value.length > 280) return false;
  if (looksTechnical(value)) return false;
  return true;
}
