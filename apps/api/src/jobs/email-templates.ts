import { readFileSync } from "node:fs";
import path from "node:path";

export type EmailAudience = "vendor" | "admin";

const logoCid = "s7-logo";
let logoBytes: Buffer | undefined;

export function emailAttachments() {
  logoBytes ??= readFileSync(path.join(__dirname, "../../assets/s7-logo.png"));
  return [
    {
      filename: "s7-logo.png",
      content: logoBytes,
      cid: logoCid,
      contentType: "image/png",
      contentDisposition: "inline" as const,
    },
  ];
}

const themes: Record<string, { label: string; color: string; on: string; action: string }> = {
  invitation: { label: "Invitation", color: "#F52D71", on: "#ffffff", action: "Open invitation" },
  correction: { label: "Correction requested", color: "#B76E00", on: "#ffffff", action: "Update the requested fields" },
  "submission-ack": { label: "Submission", color: "#F52D71", on: "#ffffff", action: "View submission" },
  approved: { label: "Approved", color: "#16803D", on: "#ffffff", action: "View the approved form" },
  rejected: { label: "Not approved", color: "#C9372C", on: "#ffffff", action: "View the submission" },
  "password-reset": { label: "Password reset", color: "#F52D71", on: "#ffffff", action: "Reset password" },
  credentials: { label: "Account ready", color: "#F52D71", on: "#ffffff", action: "Open the portal" },
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
}) {
  const theme = themes[input.template] ?? { label: "Notice", color: "#F52D71", on: "#ffffff", action: "Open the portal" };
  const action = input.audience === "admin" && input.template !== "password-reset" ? "Open the admin portal" : theme.action;
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const text = [input.organizationName, theme.label, input.title, "", input.body, input.actionUrl ? `\n${action}: ${input.actionUrl}` : ""]
    .filter((line) => line !== undefined)
    .join("\n");
  const bodyHtml = paragraphs
    .map((paragraph) => `<p style="margin:0 0 12px;line-height:1.5;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = input.actionUrl
    ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:${theme.color};color:${theme.on};text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;">${escapeHtml(action)}</a></p>`
    : "";
  const audience = input.audience === "admin" ? "an administrator" : "the vendor";
  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#FFF5F9;color:#111111;font-family:Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF5F9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #F3D4E0;border-radius:8px;">
            <tr>
              <td style="height:6px;background:#F52D71;border-radius:8px 8px 0 0;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:20px 24px 8px;">
                <img src="cid:${logoCid}" width="64" height="64" alt="s7" style="display:block;width:64px;height:64px;border:0;outline:none;text-decoration:none;" />
                <p style="margin:12px 0 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6B5560;">${escapeHtml(input.organizationName)}</p>
                <p style="margin:8px 0 0;display:inline-block;background:${theme.color};color:${theme.on};border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;">${escapeHtml(theme.label)}</p>
                <h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;">${escapeHtml(input.title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 24px;font-size:15px;">
                ${bodyHtml}
                ${button}
                <p style="margin:24px 0 0;font-size:12px;color:#6B5560;">This message was sent to ${audience}. If you were not expecting it, you can ignore it.</p>
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
