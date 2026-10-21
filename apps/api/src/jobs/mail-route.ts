export type SmtpEndpoint = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

export type DeliveryRoute = SmtpEndpoint & { name: "primary" | "fallback" };

export class MailDeliveryError extends Error {
  constructor(
    message: string,
    readonly failures: unknown[],
    readonly kind: "permanent" | "retryable",
  ) {
    super(message);
  }
}

export function deliveryRoutes(primary: SmtpEndpoint, candidates: SmtpEndpoint[]): DeliveryRoute[] {
  const routes: DeliveryRoute[] = [{ ...primary, name: "primary" }];
  const seen = new Set([routeKey(primary)]);
  for (const candidate of candidates) {
    const host = candidate.host.trim();
    if (!host || host === "localhost" || host === "json") continue;
    const key = routeKey({ ...candidate, host });
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push({ ...candidate, host, name: "fallback" });
    break;
  }
  return routes;
}

export function mailFailureKind(error: unknown): "permanent" | "retryable" {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid login|authentication failed|\b535\b/i.test(message)) return "permanent";
  if (/\b(550|551|553|501)\b/.test(message) && !/rate|temporar|too many|try again|4\d\d/i.test(message)) return "permanent";
  return "retryable";
}

export function batchFailureKind(errors: unknown[]): "permanent" | "retryable" {
  if (!errors.length) return "retryable";
  return errors.every((error) => mailFailureKind(error) === "permanent") ? "permanent" : "retryable";
}

function routeKey(route: Pick<SmtpEndpoint, "host" | "port" | "user">) {
  return `${route.host.trim().toLowerCase()}:${route.port}:${route.user.trim().toLowerCase()}`;
}
