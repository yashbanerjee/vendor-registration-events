export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
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

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = csrfToken();
  if (token) headers.set("x-csrf-token", token);
  headers.set("x-requested-with", "vendor-portal");
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(`/api/v1${path}`, { ...init, headers, credentials: "include", cache: "no-store" });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as { data?: T; error?: { message?: string; code?: string; details?: unknown }; nextCursor?: string | null }) : null;
  if (!response.ok) {
    throw new ApiError(payload?.error?.message ?? "The request failed.", response.status, payload?.error?.code, payload?.error?.details);
  }
  return payload as T;
}

export async function download(path: string, filename: string) {
  const headers = new Headers();
  const token = csrfToken();
  if (token) headers.set("x-csrf-token", token);
  const response = await fetch(`/api/v1${path}`, { headers, credentials: "include", cache: "no-store" });
  if (!response.ok) throw new ApiError("The download failed.", response.status);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
