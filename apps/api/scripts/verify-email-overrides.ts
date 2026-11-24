import { PrismaClient } from "@prisma/client";
import { EMAIL_TEMPLATES } from "../src/jobs/email-catalog";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true, settings: true } });

  const want: Record<string, { actionLabel: string; subject: string }> = {
    credentials: { actionLabel: "Supplier login", subject: "Supplier Account Creation – {{exhibitionName}}" },
    "password-reset": { actionLabel: "Reset password", subject: "Forgot Password Reset Link" },
    reminder: { actionLabel: "Complete submission", subject: "Reminder: Upcoming Submission Deadline – {{deadline}}" },
    correction: { actionLabel: "Update submission", subject: "Action Required: Corrections to Your Submission – {{exhibitionName}}" },
    approved: { actionLabel: "View the approved form", subject: "Submission Request Approved – {{exhibitionName}}" },
  };

  const catalogIssues: string[] = [];
  for (const [key, expected] of Object.entries(want)) {
    const template = EMAIL_TEMPLATES.find((item) => item.key === key);
    if (!template) {
      catalogIssues.push(`missing ${key}`);
      continue;
    }
    if (template.actionLabel !== expected.actionLabel) catalogIssues.push(`${key}.actionLabel=${template.actionLabel}`);
    if (template.subject !== expected.subject) catalogIssues.push(`${key}.subject=${template.subject}`);
  }

  const overrideReport = orgs.map((org) => {
    const settings = (org.settings ?? {}) as {
      emailTemplates?: Record<string, Partial<{ subject: string; title: string; body: string; actionLabel: string }>>;
    };
    const overrides = settings.emailTemplates ?? {};
    return {
      org: org.name,
      overrideKeys: Object.keys(overrides),
      conflicting: Object.entries(overrides)
        .filter(([key]) => key in want)
        .map(([key, value]) => ({ key, actionLabel: value.actionLabel, subject: value.subject })),
    };
  });

  console.log(JSON.stringify({ catalogOk: catalogIssues.length === 0, catalogIssues, overrideReport }, null, 2));
  if (catalogIssues.length) process.exitCode = 1;
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
