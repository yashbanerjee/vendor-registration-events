import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LABELS: Record<string, string> = {
  INVITED: "Invited",
  IN_PROGRESS: "In progress",
  SUBMITTED_PENDING_REVIEW: "Waiting for review",
  RESUBMITTED_PENDING_REVIEW: "Waiting for review",
  CORRECTION_REQUESTED: "Needs changes",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REVOKED: "Revoked",
  ARCHIVED: "Archived",
  AVAILABLE: "Available",
  QUARANTINED: "Scanning",
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ACTIVE: "Active",
  DISABLED: "Disabled",
  FAILED: "Failed",
  SENT: "Sent",
  QUEUED: "Queued",
  DELIVERED: "Delivered",
  BOUNCED: "Bounced",
  PENDING: "Pending",
  PROCESSING: "Processing",
  CREATED: "Created",
  SKIPPED: "Skipped",
  ERROR: "Error",
  ORG_ADMIN: "Organization admin",
  VENDOR: "Vendor",
  REVIEWER: "Reviewer",
};

export function formatLabel(value: string): string {
  if (!value) return value;
  if (value.includes(",")) return value.split(",").map((part) => formatLabel(part.trim())).filter(Boolean).join(", ");
  const known = LABELS[value];
  if (known) return known;
  if (!/[._-]/.test(value)) {
    if (/^[A-Z0-9]+$/.test(value) && value.length > 1) return `${value.charAt(0)}${value.slice(1).toLowerCase()}`;
    if (/^[a-z][a-z0-9]*$/.test(value)) return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
    return value;
  }
  const words = value.replace(/[._-]+/g, " ").trim().toLowerCase();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
