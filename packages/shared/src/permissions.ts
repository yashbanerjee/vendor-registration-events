export const PERMISSIONS = {
  vendorsRead: "vendors.read",
  vendorsWrite: "vendors.write",
  vendorsImport: "vendors.import",
  exhibitionsRead: "exhibitions.read",
  exhibitionsWrite: "exhibitions.write",
  formsRead: "forms.read",
  formsWrite: "forms.write",
  formsPublish: "forms.publish",
  assignmentsRead: "assignments.read",
  assignmentsWrite: "assignments.write",
  submissionsRead: "submissions.read",
  submissionsReview: "submissions.review",
  documentsRead: "documents.read",
  documentsWrite: "documents.write",
  auditRead: "audit.read",
  reportsRead: "reports.read",
  reportsExport: "reports.export",
  jobsRead: "jobs.read",
  jobsRetry: "jobs.retry",
  settingsManage: "settings.manage",
  usersManage: "users.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const ROLE_NAMES = {
  orgAdmin: "ORG_ADMIN",
  reviewer: "REVIEWER",
  vendor: "VENDOR",
} as const;

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [ROLE_NAMES.orgAdmin]: ALL_PERMISSIONS,
  [ROLE_NAMES.reviewer]: [
    PERMISSIONS.vendorsRead,
    PERMISSIONS.exhibitionsRead,
    PERMISSIONS.formsRead,
    PERMISSIONS.assignmentsRead,
    PERMISSIONS.submissionsRead,
    PERMISSIONS.submissionsReview,
    PERMISSIONS.documentsRead,
    PERMISSIONS.reportsRead,
    PERMISSIONS.auditRead,
  ],
  [ROLE_NAMES.vendor]: [],
};
