export type EmailTemplateKey =
  | "invitation"
  | "invitation-changed"
  | "reminder"
  | "correction"
  | "invitation-admin"
  | "correction-admin"
  | "credentials"
  | "password-reset"
  | "approved"
  | "approved-admin"
  | "rejected"
  | "rejected-admin"
  | "submission-ack"
  | "submission-admin"
  | "packet"
  | "packet-assign"
  | "packet-reupload"
  | "invitations-queued";

export type EmailTemplateAudience = "vendor" | "admin";

export type EmailTemplateCopy = {
  subject: string;
  title: string;
  body: string;
  actionLabel: string;
};

export type EmailTemplateDefinition = EmailTemplateCopy & {
  key: EmailTemplateKey;
  label: string;
  description: string;
  audience: EmailTemplateAudience;
  variables: { key: string; label: string }[];
};

export type EmailTemplateOverrides = Partial<Record<EmailTemplateKey, Partial<EmailTemplateCopy>>>;

export const EMAIL_TEMPLATES: EmailTemplateDefinition[] = [
  {
    key: "invitation",
    label: "Form invitation",
    description: "Sent to a company when a form is assigned.",
    audience: "vendor",
    actionLabel: "Open invitation",
    subject: "Complete {{formName}} for {{exhibitionName}}",
    title: "Complete {{formName}} for {{exhibitionName}}",
    body: "{{intro}}\n\nThe form is here:\n{{link}}\n\nThis invitation expires in {{invitationHours}} hours.",
    variables: [
      { key: "companyName", label: "Company name" },
      { key: "formName", label: "Form name" },
      { key: "exhibitionName", label: "Event name" },
      { key: "intro", label: "Invitation intro" },
      { key: "link", label: "Invitation link" },
      { key: "invitationHours", label: "Hours until expiry" },
      { key: "actorName", label: "Sender name" },
    ],
  },
  {
    key: "invitation-changed",
    label: "Form changed",
    description: "Sent when an organizer replaces the assigned form.",
    audience: "vendor",
    actionLabel: "Open invitation",
    subject: "Complete {{formName}} for {{exhibitionName}}",
    title: "Complete {{formName}} for {{exhibitionName}}",
    body: "{{intro}}\n\nThe form is here:\n{{link}}\n\nThis invitation expires in {{invitationHours}} hours.",
    variables: [
      { key: "companyName", label: "Company name" },
      { key: "formName", label: "Form name" },
      { key: "exhibitionName", label: "Event name" },
      { key: "intro", label: "Change intro" },
      { key: "link", label: "Invitation link" },
      { key: "invitationHours", label: "Hours until expiry" },
      { key: "actorName", label: "Sender name" },
    ],
  },
  {
    key: "reminder",
    label: "Form reminder",
    description: "Sent when an organizer reminds a company to finish the form.",
    audience: "vendor",
    actionLabel: "Open invitation",
    subject: "Reminder: {{formName}}",
    title: "Reminder: {{formName}}",
    body: "{{intro}}\n\nThe form is here:\n{{link}}\n\nThis invitation expires in {{invitationHours}} hours.",
    variables: [
      { key: "companyName", label: "Company name" },
      { key: "formName", label: "Form name" },
      { key: "exhibitionName", label: "Event name" },
      { key: "intro", label: "Reminder intro" },
      { key: "link", label: "Invitation link" },
      { key: "invitationHours", label: "Hours until expiry" },
    ],
  },
  {
    key: "correction",
    label: "Correction request",
    description: "Sent when answers need to be fixed.",
    audience: "vendor",
    actionLabel: "Update the requested fields",
    subject: "Update {{fieldCount}} field{{fieldCountPlural}} on {{formName}}",
    title: "Update {{fieldCount}} field{{fieldCountPlural}} on {{formName}}",
    body: "{{intro}}\n\nThe form is here:\n{{link}}\n\nThis invitation expires in {{invitationHours}} hours.",
    variables: [
      { key: "companyName", label: "Company name" },
      { key: "formName", label: "Form name" },
      { key: "exhibitionName", label: "Event name" },
      { key: "fieldCount", label: "Number of fields" },
      { key: "fieldCountPlural", label: "Plural s (empty or s)" },
      { key: "intro", label: "Correction details" },
      { key: "link", label: "Invitation link" },
      { key: "invitationHours", label: "Hours until expiry" },
    ],
  },
  {
    key: "invitation-admin",
    label: "Invitation notice (admin)",
    description: "Sent to organizers when a company invitation goes out.",
    audience: "admin",
    actionLabel: "Open the admin portal",
    subject: "Invitation sent to {{companyName}}",
    title: "Invitation sent",
    body: "{{companyName}} ({{companyEmail}}) received this request. The invitation link was sent only to the company.",
    variables: [
      { key: "companyName", label: "Company name" },
      { key: "companyEmail", label: "Company email" },
    ],
  },
  {
    key: "correction-admin",
    label: "Correction notice (admin)",
    description: "Sent to organizers when a correction request is emailed.",
    audience: "admin",
    actionLabel: "Open the admin portal",
    subject: "Corrections sent to {{companyName}}",
    title: "Corrections sent",
    body: "{{companyName}} ({{companyEmail}}) received this request. The invitation link was sent only to the company.",
    variables: [
      { key: "companyName", label: "Company name" },
      { key: "companyEmail", label: "Company email" },
    ],
  },
  {
    key: "credentials",
    label: "Account credentials",
    description: "Sent after a company is created by bulk upload.",
    audience: "vendor",
    actionLabel: "Open the portal",
    subject: "Your iktva login",
    title: "Your account is ready",
    body: "Use these details to sign in. Change the temporary password before you open an exhibition form.\n\nPortal: {{portal}}\nEmail: {{email}}\nTemporary password: {{password}}",
    variables: [
      { key: "portal", label: "Portal URL" },
      { key: "email", label: "Login email" },
      { key: "password", label: "Temporary password" },
      { key: "companyName", label: "Company name" },
    ],
  },
  {
    key: "password-reset",
    label: "Password reset",
    description: "Sent when someone asks to reset a password.",
    audience: "vendor",
    actionLabel: "Reset password",
    subject: "Reset your iktva password",
    title: "Password reset",
    body: "A password reset was requested. Open {{link}} within one hour. If you did not request this, you can ignore the message.",
    variables: [{ key: "link", label: "Reset link" }],
  },
  {
    key: "approved",
    label: "Submission approved",
    description: "Sent to a company when its answers are accepted.",
    audience: "vendor",
    actionLabel: "View the approved form",
    subject: "{{formName}} was approved",
    title: "Submission approved",
    body: "Your submission for {{formName}} at {{exhibitionName}} was approved. The approved answers are now locked.",
    variables: [
      { key: "companyName", label: "Company name" },
      { key: "formName", label: "Form name" },
      { key: "exhibitionName", label: "Event name" },
    ],
  },
  {
    key: "approved-admin",
    label: "Approval notice (admin)",
    description: "Sent to organizers when a submission is approved.",
    audience: "admin",
    actionLabel: "Open the admin portal",
    subject: "{{companyName}} was approved",
    title: "Submission approved",
    body: "{{companyName}} was approved for {{formName}} at {{exhibitionName}}.",
    variables: [
      { key: "companyName", label: "Company name" },
      { key: "formName", label: "Form name" },
      { key: "exhibitionName", label: "Event name" },
    ],
  },
  {
    key: "rejected",
    label: "Submission not approved",
    description: "Sent to a company when its answers are rejected.",
    audience: "vendor",
    actionLabel: "View the submission",
    subject: "{{formName}} was not approved",
    title: "Submission not approved",
    body: "Your submission for {{formName}} at {{exhibitionName}} was not approved.\n\n{{reason}}",
    variables: [
      { key: "companyName", label: "Company name" },
      { key: "formName", label: "Form name" },
      { key: "exhibitionName", label: "Event name" },
      { key: "reason", label: "Rejection reason" },
    ],
  },
  {
    key: "rejected-admin",
    label: "Rejection notice (admin)",
    description: "Sent to organizers when a submission is rejected.",
    audience: "admin",
    actionLabel: "Open the admin portal",
    subject: "{{companyName}} was not approved",
    title: "Submission not approved",
    body: "{{companyName}} was not approved for {{formName}}.\n\n{{reason}}",
    variables: [
      { key: "companyName", label: "Company name" },
      { key: "formName", label: "Form name" },
      { key: "exhibitionName", label: "Event name" },
      { key: "reason", label: "Rejection reason" },
    ],
  },
  {
    key: "submission-ack",
    label: "Submission received",
    description: "Sent to a company after it sends a form.",
    audience: "vendor",
    actionLabel: "View submission",
    subject: "{{subjectLine}}",
    title: "{{subjectLine}}",
    body: "{{bodyText}}",
    variables: [
      { key: "companyName", label: "Company name" },
      { key: "formName", label: "Form name" },
      { key: "exhibitionName", label: "Event name" },
      { key: "subjectLine", label: "Default subject line" },
      { key: "bodyText", label: "Default body text" },
    ],
  },
  {
    key: "submission-admin",
    label: "Submission notice (admin)",
    description: "Sent to reviewers when a company submits answers.",
    audience: "admin",
    actionLabel: "Open the admin portal",
    subject: "{{subjectLine}}",
    title: "{{subjectLine}}",
    body: "{{bodyText}}",
    variables: [
      { key: "companyName", label: "Company name" },
      { key: "formName", label: "Form name" },
      { key: "exhibitionName", label: "Event name" },
      { key: "subjectLine", label: "Default subject line" },
      { key: "bodyText", label: "Default body text" },
    ],
  },
  {
    key: "packet",
    label: "New PDF form",
    description: "Sent when a PDF form is added to an event.",
    audience: "vendor",
    actionLabel: "Open your forms",
    subject: "New form for {{exhibitionName}}",
    title: "New form for {{exhibitionName}}",
    body: "{{formName}} was added for {{exhibitionName}}. Sign in and download it from your dashboard. Fill it in, then upload the completed PDF. You can also attach any extra documents with a name.",
    variables: [
      { key: "exhibitionName", label: "Event name" },
      { key: "formName", label: "PDF form name" },
    ],
  },
  {
    key: "packet-assign",
    label: "PDF forms assigned",
    description: "Sent when companies are invited to an event’s PDF forms.",
    audience: "vendor",
    actionLabel: "Open your forms",
    subject: "Forms for {{exhibitionName}}",
    title: "Forms for {{exhibitionName}}",
    body: "{{bodyText}}",
    variables: [
      { key: "exhibitionName", label: "Event name" },
      { key: "formNames", label: "PDF form names" },
      { key: "bodyText", label: "Default body text" },
    ],
  },
  {
    key: "packet-reupload",
    label: "PDF re-upload request",
    description: "Sent when a company must upload a PDF or document again.",
    audience: "vendor",
    actionLabel: "Open your forms",
    subject: "Please re-upload {{itemName}}",
    title: "Please re-upload {{itemName}}",
    body: "{{bodyText}}",
    variables: [
      { key: "itemName", label: "Form or document name" },
      { key: "exhibitionName", label: "Event name" },
      { key: "note", label: "Organizer note" },
      { key: "bodyText", label: "Default body text" },
    ],
  },
  {
    key: "invitations-queued",
    label: "Bulk invitations queued (admin)",
    description: "Sent to the organizer after a bulk invitation starts.",
    audience: "admin",
    actionLabel: "Open the admin portal",
    subject: "{{assigned}} exhibition invitations were queued",
    title: "Invitations queued",
    body: "{{bodyText}}",
    variables: [
      { key: "assigned", label: "Number queued" },
      { key: "bodyText", label: "Default body text" },
    ],
  },
];

const byKey = new Map(EMAIL_TEMPLATES.map((item) => [item.key, item]));

const adminKeyByTemplate: Record<string, EmailTemplateKey> = {
  invitation: "invitation-admin",
  correction: "correction-admin",
  approved: "approved-admin",
  rejected: "rejected-admin",
  "submission-ack": "submission-admin",
  "invitations-queued": "invitations-queued",
};

export function emailTemplateDefinition(key: string) {
  return byKey.get(key as EmailTemplateKey) ?? null;
}

export function catalogKeyFor(template: string, audience: EmailTemplateAudience = "vendor"): EmailTemplateKey | null {
  if (audience === "admin") {
    const mapped = adminKeyByTemplate[template];
    if (mapped) return mapped;
  }
  if (byKey.has(template as EmailTemplateKey)) return template as EmailTemplateKey;
  return null;
}

export function fillTemplate(template: string, vars: Record<string, string | number | undefined | null>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function composeEmailTemplate(
  key: EmailTemplateKey,
  vars: Record<string, string | number | undefined | null> = {},
  overrides?: EmailTemplateOverrides | null,
): EmailTemplateCopy & { key: EmailTemplateKey; audience: EmailTemplateAudience } {
  const definition = byKey.get(key);
  if (!definition) throw new Error(`Unknown email template: ${key}`);
  const custom = overrides?.[key] ?? {};
  return {
    key,
    audience: definition.audience,
    subject: fillTemplate(custom.subject?.trim() || definition.subject, vars),
    title: fillTemplate(custom.title?.trim() || definition.title, vars),
    body: fillTemplate(custom.body?.trim() || definition.body, vars),
    actionLabel: fillTemplate(custom.actionLabel?.trim() || definition.actionLabel, vars),
  };
}

export function listEmailTemplates(overrides?: EmailTemplateOverrides | null) {
  return EMAIL_TEMPLATES.map((item) => {
    const custom = overrides?.[item.key] ?? {};
    return {
      ...item,
      subject: custom.subject?.trim() || item.subject,
      title: custom.title?.trim() || item.title,
      body: custom.body?.trim() || item.body,
      actionLabel: custom.actionLabel?.trim() || item.actionLabel,
      customized: Boolean(custom.subject || custom.title || custom.body || custom.actionLabel),
    };
  });
}
