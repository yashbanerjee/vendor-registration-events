export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function csrfToken() {
  if (typeof document === "undefined") return "";
  const raw = document.cookie.split("; ").find((row) => row.startsWith("csrf="));
  return raw ? decodeURIComponent(raw.slice(5)) : "";
}

function reportClientError(input: {
  path: string;
  method: string;
  statusCode: number;
  code?: string;
  message: string;
  details?: unknown;
  correlationId?: string;
}) {
  if (typeof window === "undefined") return;
  if (input.path.startsWith("/client-errors")) return;
  const headers = new Headers({ "x-requested-with": "vendor-portal", "content-type": "application/json" });
  const token = csrfToken();
  if (token) headers.set("x-csrf-token", token);
  void fetch("/api/v1/client-errors", {
    method: "POST",
    headers,
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify({
      ...input,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : "",
    }),
  }).catch(() => undefined);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = csrfToken();
  if (token) headers.set("x-csrf-token", token);
  headers.set("x-requested-with", "vendor-portal");
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const method = (init.method ?? "GET").toUpperCase();
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { ...init, headers, credentials: "include", cache: "no-store" });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Network request failed.";
    reportClientError({ path, method, statusCode: 0, code: "NETWORK", message });
    throw new ApiError(message, 0, "NETWORK");
  }
  const text = await response.text();
  type ApiPayload = { data?: T; error?: { message?: string; code?: string; details?: unknown; correlationId?: string }; nextCursor?: string | null };
  let payload: ApiPayload | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as ApiPayload;
    } catch {
      const message = text.trim().startsWith("<")
        ? "The server returned an unexpected page instead of a response."
        : text.slice(0, 240) || "The server returned an invalid response.";
      reportClientError({
        path,
        method,
        statusCode: response.status,
        code: "INVALID_JSON",
        message,
        details: { bodyPreview: text.slice(0, 500) },
      });
      throw new ApiError(message, response.status, "INVALID_JSON");
    }
  }
  if (!response.ok) {
    const message = payload?.error?.message ?? "The request failed.";
    if (response.status >= 500) {
      reportClientError({
        path,
        method,
        statusCode: response.status,
        code: payload?.error?.code,
        message,
        details: payload?.error?.details,
        correlationId: payload?.error?.correlationId,
      });
    }
    throw new ApiError(message, response.status, payload?.error?.code, payload?.error?.details, payload?.error?.correlationId);
  }
  return payload as T;
}

export async function download(path: string, filename: string) {
  const headers = new Headers();
  const token = csrfToken();
  if (token) headers.set("x-csrf-token", token);
  headers.set("x-requested-with", "vendor-portal");
  const response = await fetch(`/api/v1${path}`, { headers, credentials: "include", cache: "no-store" });
  if (!response.ok) {
    const text = await response.text();
    let message = "The download failed.";
    let code: string | undefined;
    let details: unknown;
    try {
      const payload = JSON.parse(text) as { error?: { message?: string; code?: string; details?: unknown; correlationId?: string } };
      if (payload.error?.message) message = payload.error.message;
      code = payload.error?.code;
      details = payload.error?.details;
      reportClientError({ path, method: "GET", statusCode: response.status, code, message, details, correlationId: payload.error?.correlationId });
    } catch {
      message = text.slice(0, 240) || message;
      reportClientError({ path, method: "GET", statusCode: response.status, code: "INVALID_JSON", message, details: { bodyPreview: text.slice(0, 500) } });
    }
    throw new ApiError(message, response.status, code, details);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
