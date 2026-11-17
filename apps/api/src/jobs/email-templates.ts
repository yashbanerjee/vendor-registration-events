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

/**
 * HTML email layout matched to the portal brand: dark page, dark card,
 * copper-to-blue rule, and a blue uppercase action button.
 */
export function renderEmail(input: {
  template: string;
  audience: EmailAudience;
  organizationName: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  fromAddress?: string;
}) {
  const action = input.actionLabel
    || (input.audience === "admin" && input.template !== "password-reset" ? "Open the admin portal" : actions[input.template] ?? "Open the portal");
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const actionLine = input.actionUrl && !input.body.includes(input.actionUrl) ? `\n${action}: ${input.actionUrl}` : "";
  const text = [input.organizationName, input.title, "", input.body, actionLine].filter((line) => line !== undefined).join("\n");
  const bodyHtml = paragraphs
    .map((paragraph) => `<p style="margin:0 0 14px;color:#eef2f5;font-size:15px;line-height:1.6;">${linkify(escapeHtml(paragraph).replace(/\n/g, "<br>"))}</p>`)
    .join("");
  const buttonHtml = input.actionUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
        <tr>
          <td style="border-radius:4px;background:#0064ad;border:1px solid rgba(0,158,240,0.7);">
            <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.16em;line-height:1;text-decoration:none;text-transform:uppercase;">${escapeHtml(action)}</a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 12px;color:#6b7885;font-size:12px;line-height:1.5;word-break:break-all;">Or open this link:<br><a href="${escapeHtml(input.actionUrl)}" style="color:#a3d9f6;text-decoration:underline;">${escapeHtml(input.actionUrl)}</a></p>`
    : "";
  const audience = input.audience === "admin" ? "an administrator" : "a company";
  const sender = input.fromAddress ? ` It was sent from ${escapeHtml(input.fromAddress)}.` : "";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0a0c0e;color:#eef2f5;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0c0e;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#111519;border:1px solid rgba(255,255,255,0.1);border-radius:6px;">
            <tr>
              <td style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,#dda36c,#ad642d 30%,#4a7cb9 70%,#009ef0);">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:28px 28px 32px;">
                <p style="margin:0 0 10px;color:#dda36c;font-size:11px;font-weight:700;letter-spacing:0.18em;line-height:1.2;text-transform:uppercase;">${escapeHtml(input.organizationName)}</p>
                <h1 style="margin:0 0 10px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.02em;line-height:1.25;text-transform:uppercase;">${escapeHtml(input.title)}</h1>
                <div style="width:44px;height:2px;margin:0 0 20px;background:linear-gradient(90deg,#dda36c,#ad642d 30%,#4a7cb9 70%,#009ef0);">&nbsp;</div>
                ${bodyHtml}
                ${buttonHtml}
                <p style="margin:28px 0 0;padding-top:18px;border-top:1px solid rgba(255,255,255,0.1);color:#6b7885;font-size:12px;line-height:1.5;">This message was sent to ${audience} about a form or account with ${escapeHtml(input.organizationName)}.${sender}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return { html, text };
}

function linkify(escaped: string) {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (url) => {
    const clean = url.replace(/[).,]+$/, "");
    const tail = url.slice(clean.length);
    return `<a href="${clean}" style="color:#a3d9f6;text-decoration:underline;">${clean}</a>${tail}`;
  });
}
