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

/** Public asset URL for email images. Skips localhost so inboxes do not load a broken local image. */
export function publicAssetUrl(origin: string, path: string) {
  const resolved = absoluteUrl(path, origin);
  if (!resolved || isLoopback(resolved) || !resolved.startsWith("https://")) return undefined;
  return resolved;
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
 * HTML email layout matched to the portal brand: dark page, sheened card,
 * copper-to-blue accents, and a blue uppercase action button.
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
  logoUrl?: string;
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
    .map((paragraph) => `<p style="margin:0 0 12px;color:#d7e0e8;font-family:Montserrat,sans-serif;font-size:15px;line-height:1.65;">${linkify(escapeHtml(paragraph).replace(/\n/g, "<br>"))}</p>`)
    .join("");
  const logoHtml = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" width="168" alt="${escapeHtml(input.organizationName)}" style="display:block;width:168px;max-width:60%;height:auto;border:0;outline:none;text-decoration:none;">`
    : `<p style="margin:0;color:#ffffff;font-family:Montserrat,sans-serif;font-size:18px;font-weight:700;letter-spacing:0.04em;line-height:1.2;">${escapeHtml(input.organizationName)}</p>`;
  const buttonHtml = input.actionUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;">
        <tr>
          <td align="center" style="padding:4px 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#0064ad" style="border-radius:4px;background:#0064ad;border:1px solid #009ef0;box-shadow:0 14px 30px rgba(0,100,173,0.35);">
                  <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:16px 34px;color:#ffffff;font-family:Montserrat,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.16em;line-height:1;text-decoration:none;text-transform:uppercase;">${escapeHtml(action)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:16px 8px 0;">
            <p style="margin:0;color:#6b7885;font-family:Montserrat,sans-serif;font-size:11px;line-height:1.55;word-break:break-all;">
              If the button does not work, copy and paste this link into your browser:<br>
              <a href="${escapeHtml(input.actionUrl)}" style="color:#a3d9f6;text-decoration:underline;">${escapeHtml(input.actionUrl)}</a>
            </p>
          </td>
        </tr>
      </table>`
    : "";
  const audience = input.audience === "admin" ? "an administrator" : "a vendor";
  const sender = input.fromAddress ? ` It was sent from ${escapeHtml(input.fromAddress)}.` : "";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark light">
    <meta name="supported-color-schemes" content="dark light">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#07090b;color:#eef2f5;font-family:Montserrat,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(input.title)} — ${escapeHtml(input.organizationName)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#07090b;">
      <tr>
        <td align="center" style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#07090b;">
            <tr>
              <td style="padding:36px 18px 12px;" align="center">
                <!-- Brand header -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
                  <tr>
                    <td align="left" style="padding:0 4px 18px;">
                      ${logoHtml}
                    </td>
                  </tr>
                </table>

                <!-- Card -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#111519;border:1px solid rgba(255,255,255,0.12);border-radius:8px;overflow:hidden;">
                  <tr>
                    <td style="height:4px;line-height:4px;font-size:0;background:#dda36c;background-image:linear-gradient(90deg,#dda36c,#ad642d 28%,#4a7cb9 68%,#009ef0);">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:0;background:#111519;background-image:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0) 42%);">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding:28px 28px 8px;">
                            <p style="margin:0 0 8px;color:#dda36c;font-family:Montserrat,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.2em;line-height:1.3;text-transform:uppercase;">${escapeHtml(input.organizationName)}</p>
                            <h1 style="margin:0;color:#ffffff;font-family:Montserrat,sans-serif;font-size:24px;font-weight:700;letter-spacing:0.03em;line-height:1.28;text-transform:uppercase;">${escapeHtml(input.title)}</h1>
                            <div style="width:52px;height:3px;margin:16px 0 0;background:#009ef0;background-image:linear-gradient(90deg,#dda36c,#009ef0);font-size:0;line-height:0;">&nbsp;</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:18px 28px 8px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a2027;border:1px solid rgba(255,255,255,0.08);border-radius:6px;">
                              <tr>
                                <td style="padding:18px 18px 6px;">
                                  ${bodyHtml || `<p style="margin:0 0 12px;color:#d7e0e8;font-family:Montserrat,sans-serif;font-size:15px;line-height:1.65;">&nbsp;</p>`}
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        ${buttonHtml ? `<tr><td style="padding:24px 28px 8px;">${buttonHtml}</td></tr>` : ""}
                        <tr>
                          <td style="padding:24px 28px 28px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="height:1px;line-height:1px;font-size:0;background:rgba(255,255,255,0.1);">&nbsp;</td>
                              </tr>
                              <tr>
                                <td style="padding-top:16px;">
                                  <p style="margin:0;color:#6b7885;font-family:Montserrat,sans-serif;font-size:12px;line-height:1.55;">This message was sent to ${audience} about a form or account with ${escapeHtml(input.organizationName)}.${sender}</p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="height:3px;line-height:3px;font-size:0;background:#009ef0;background-image:linear-gradient(90deg,#009ef0,#4a7cb9 40%,#ad642d 75%,#dda36c);">&nbsp;</td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
                  <tr>
                    <td align="center" style="padding:18px 8px 8px;">
                      <p style="margin:0;color:#566774;font-family:Montserrat,sans-serif;font-size:11px;letter-spacing:0.12em;line-height:1.4;text-transform:uppercase;">${escapeHtml(input.organizationName)}</p>
                    </td>
                  </tr>
                </table>
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
