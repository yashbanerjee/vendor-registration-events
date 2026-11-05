export type EmailAudience = "vendor" | "admin";

const actions: Record<string, string> = {
  invitation: "Open invitation",
  correction: "Update the requested fields",
  "submission-ack": "View submission",
  approved: "View the approved form",
  rejected: "View the submission",
  "password-reset": "Reset password",
  credentials: "Open the portal",
  packet: "Open your forms",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character] ?? character;
  });
}

export function absoluteUrl(link: string, origin: string) {
  if (!link) return "";
  if (link.startsWith("http://") || link.startsWith("https://")) return link;
  const base = origin.replace(/\/$/, "");
  return `${base}${link.startsWith("/") ? link : `/${link}`}`;
}

export function publicActionUrl(input: { link: string; text?: string; origin: string }) {
  const resolved = absoluteUrl(input.link, input.origin);
  if (!resolved || !isLoopback(resolved)) return resolved;
  const path = input.link.startsWith("/") ? input.link : "";
  if (!path) return resolved;
  const embedded = input.text?.match(/https:\/\/[^\s<>"']+/g) ?? [];
  const match = embedded
    .map((url) => url.replace(/[).,]+$/, ""))
    .find((url) => {
      try {
        return new URL(url).pathname === path;
      } catch {
        return false;
      }
    });
  return match ?? resolved;
}

function isLoopback(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

export function renderEmail(input: {
  template: string;
  audience: EmailAudience;
  organizationName: string;
  title: string;
  body: string;
  actionUrl?: string;
  fromAddress?: string;
}) {
  const action = input.audience === "admin" && input.template !== "password-reset" ? "Open the admin portal" : actions[input.template] ?? "Open the portal";
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const actionLine = input.actionUrl && !input.body.includes(input.actionUrl) ? `\n${action}: ${input.actionUrl}` : "";
  const text = [input.organizationName, input.title, "", input.body, actionLine].filter((line) => line !== undefined).join("\n");
  const bodyHtml = paragraphs
    .map((paragraph) => `<p style="margin:0 0 12px;">${linkify(escapeHtml(paragraph).replace(/\n/g, "<br>"))}</p>`)
    .join("");
  const extraLink = input.actionUrl && !input.body.includes(input.actionUrl)
    ? `<p style="margin:0 0 12px;"><a href="${escapeHtml(input.actionUrl)}">${escapeHtml(input.actionUrl)}</a></p>`
    : "";
  const audience = input.audience === "admin" ? "an administrator" : "a company";
  const sender = input.fromAddress ? ` It was sent from ${escapeHtml(input.fromAddress)}.` : "";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;">
    <p style="margin:0 0 8px;font-size:13px;color:#444444;">${escapeHtml(input.organizationName)}</p>
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;font-weight:600;">${escapeHtml(input.title)}</h1>
    ${bodyHtml}
    ${extraLink}
    <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#444444;">This message was sent to ${audience} about a form or account with ${escapeHtml(input.organizationName)}.${sender}</p>
  </body>
</html>`;
  return { html, text };
}

function linkify(escaped: string) {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (url) => {
    const clean = url.replace(/[).,]+$/, "");
    const tail = url.slice(clean.length);
    return `<a href="${clean}">${clean}</a>${tail}`;
  });
}
