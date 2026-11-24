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
    description: "Sent to a vendor when a form is assigned.",
    audience: "vendor",
    actionLabel: "Open invitation",
    subject: "Complete {{formName}} for {{exhibitionName}}",
    title: "Complete {{formName}} for {{exhibitionName}}",
    body: "{{intro}}\n\nThe form is here:\n{{link}}\n\nThis invitation expires in {{invitationHours}} hours.",
    variables: [
      { key: "companyName", label: "Vendor name" },
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
      { key: "companyName", label: "Vendor name" },
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
    label: "Deadline reminder",
    description: "Sent when an organizer reminds a vendor that the submission deadline is approaching.",
    audience: "vendor",
    actionLabel: "Open the form",
    subject: "Reminder: Upcoming Submission Deadline – {{deadline}}",
    title: "Reminder: Upcoming Submission Deadline",
    body: "Dear {{companyName}},\n\nThis is a friendly reminder that your exhibitor submission is still pending.\n\nKindly complete and submit all required information and documents before {{deadline}} to ensure timely review and approval by our administration team.\n\nPlease note that submissions received after the deadline may affect your participation in the exhibition.\n\nWe kindly request your immediate attention and cooperation to avoid any delays.\n\nThe form is here:\n{{link}}\n\nThank you for your support.\n\nBest regards,\nExhibition Administration Team\n{{exhibitionName}}",
    variables: [
      { key: "companyName", label: "Vendor name" },
      { key: "formName", label: "Form name" },
      { key: "exhibitionName", label: "Exhibition name" },
      { key: "deadline", label: "Submission deadline" },
      { key: "intro", label: "Reminder intro" },
      { key: "link", label: "Form link" },
      { key: "invitationHours", label: "Hours until expiry" },
    ],
  },
  {
    key: "correction",
    label: "Correction request",
    description: "Sent when admin asks a vendor to correct specific fields.",
    audience: "vendor",
    actionLabel: "Update the requested fields",
    subject: "Action Required: Corrections to Your Submission – {{exhibitionName}}",
    title: "Action Required: Corrections to Your Submission",
    body: "Dear {{companyName}},\n\nGreetings from the Exhibition Admin Team.\n\nFollowing our review of your submission for {{exhibitionName}}, we would like to inform you that certain information requires correction or updating before your submission can be approved.\n\n1. Review Comments\nPlease review the following notes provided by our Admin Team:\n{{intro}}\n\n2. Fields Requiring Correction\nPlease update only the fields listed below:\n{{fieldList}}\n\n3. Secure Form Update Link\nPlease use the secure link below to access your pre-filled submission form:\nSecure Update Link: {{link}}\n\nPlease note:\n• Your previously submitted information has been retained.\n• Only the fields identified for correction have been unlocked for editing.\n• All other fields will remain locked and cannot be modified.\n• Please review the updated information carefully before resubmitting.\n\n4. Resubmission Deadline\nKindly complete the required corrections and resubmit your form by:\nDeadline: {{deadline}}\n\nOnce resubmitted, the Exhibition Admin Team will review the updated information and notify you of the outcome.\n\nIf you require any clarification regarding the requested corrections, please contact the Exhibition Admin Team.\n\nThank you for your cooperation.\n\nBest regards,\nExhibition Administration Team\n{{exhibitionName}}",
    variables: [
      { key: "companyName", label: "Vendor name" },
      { key: "formName", label: "Form name" },
      { key: "exhibitionName", label: "Exhibition name" },
      { key: "fieldCount", label: "Number of fields" },
      { key: "fieldCountPlural", label: "Plural s (empty or s)" },
      { key: "intro", label: "Review comments summary" },
      { key: "fieldList", label: "Fields requiring correction" },
      { key: "link", label: "Secure update link" },
      { key: "deadline", label: "Resubmission deadline" },
      { key: "invitationHours", label: "Hours until expiry" },
    ],
  },
  {
    key: "invitation-admin",
    label: "Invitation notice (admin)",
    description: "Sent to organizers when a vendor invitation goes out.",
    audience: "admin",
    actionLabel: "Open the admin portal",
    subject: "Invitation sent to {{companyName}}",
    title: "Invitation sent",
    body: "{{companyName}} ({{companyEmail}}) received this request. The invitation link was sent only to the vendor.",
    variables: [
      { key: "companyName", label: "Vendor name" },
      { key: "companyEmail", label: "Vendor email" },
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
    body: "{{companyName}} ({{companyEmail}}) received this request. The invitation link was sent only to the vendor.",
    variables: [
      { key: "companyName", label: "Vendor name" },
      { key: "companyEmail", label: "Vendor email" },
    ],
  },
  {
    key: "credentials",
    label: "Vendor account created",
    description: "Sent after a vendor is created by bulk upload.",
    audience: "vendor",
    actionLabel: "Open vendor login",
    subject: "Vendor Account Creation – {{exhibitionName}}",
    title: "Vendor Account Creation",
    body: "Dear {{companyName}},\n\nGreetings!\n\nWe are pleased to inform you that your vendor account has been successfully created for {{exhibitionName}}.\n\nPlease find your login credentials below:\n\nVendor Account Details\n• Exhibition Name: {{exhibitionName}}\n• Vendor Company Name: {{companyName}}\n• Vendor ID: {{vendorId}}\n• Login Email: {{email}}\n• Temporary Password: {{password}}\n• Vendor Login Link: {{portal}}\n\nLogin Instructions:\n1. Click on the Vendor Login Link above.\n2. Enter your Login Email and Temporary Password.\n3. Log in to your account.\n4. Change your temporary password, if prompted.\n5. Complete the required vendor information and registration process.\n\nPlease keep your login credentials confidential and do not share them with unauthorized persons.\n\nShould you require any assistance or encounter any login issues, please contact our support team.\n\nThank you for your participation in {{exhibitionName}}.\n\nBest regards,\nExhibition Support Team\n{{exhibitionName}}",
    variables: [
      { key: "portal", label: "Vendor login URL" },
      { key: "email", label: "Login email" },
      { key: "password", label: "Temporary password" },
      { key: "companyName", label: "Vendor company name" },
      { key: "vendorId", label: "Vendor ID / reference" },
      { key: "exhibitionName", label: "Exhibition name" },
    ],
  },
  {
    key: "password-reset",
    label: "Forgot password",
    description: "Sent when someone asks to reset a password.",
    audience: "vendor",
    actionLabel: "Reset password",
    subject: "Forgot Password Reset Link",
    title: "Forgot Password Reset Link",
    body: "Dear {{userName}},\n\nGreetings!\n\nWe received a request to reset your password.\n\nPlease click the link below to create a new password:\n{{link}}\n\nFor security reasons, this link will expire in {{expiryText}}.\n\nIf you did not request a password reset, please ignore this email.\n\nBest regards,\nExhibition Support Team\n{{exhibitionName}}",
    variables: [
      { key: "link", label: "Reset link" },
      { key: "userName", label: "User name" },
      { key: "expiryText", label: "Link expiry text" },
      { key: "exhibitionName", label: "Exhibition / organization name" },
    ],
  },
  {
    key: "approved",
    label: "Submission approved",
    description: "Sent to a vendor when its answers are accepted.",
    audience: "vendor",
    actionLabel: "View the approved form",
    subject: "Submission Request Approved – {{exhibitionName}}",
    title: "Submission Request Approved",
    body: "Dear {{companyName}},\n\nWe are pleased to inform you that your submission has been reviewed and approved by our administration team.\n\nCongratulations! Your participation has been successfully confirmed.\n\nThank you for your interest in being part of {{exhibitionName}}. We look forward to welcoming you and wish you a successful exhibition.\n\nFor any further information or assistance, please feel free to contact our team.\n\nBest regards,\nExhibition Administration Team\n{{exhibitionName}}",
    variables: [
      { key: "companyName", label: "Vendor / exhibitor name" },
      { key: "formName", label: "Form name" },
      { key: "exhibitionName", label: "Exhibition name" },
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
