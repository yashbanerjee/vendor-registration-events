export type MailPace = { nextAt: number };

export type MailDecision =
  | { pace: MailPace; action: "send" }
  | { pace: MailPace; action: "wait"; availableAt: number };

const immediateHosts = new Set(["", "json", "localhost", "127.0.0.1", "::1"]);

export function mailSendIntervalMs(host: string, intervalMs: number): number {
  if (intervalMs <= 0) return 0;
  const normalized = host.trim().toLowerCase();
  if (immediateHosts.has(normalized)) return 0;
  return intervalMs;
}

/**
 * One real SMTP send may start each interval. Callers leave every other due
 * message pending until `availableAt`, so a burst stays in the queue.
 */
export function beginMailSend(pace: MailPace, now: number, intervalMs: number): MailDecision {
  if (intervalMs <= 0) return { pace, action: "send" };
  if (now < pace.nextAt) return { pace, action: "wait", availableAt: pace.nextAt };
  return { pace: { nextAt: now + intervalMs }, action: "send" };
}
