export const ASSIGNMENT_STATUSES = [
  "INVITED",
  "IN_PROGRESS",
  "SUBMITTED_PENDING_REVIEW",
  "CORRECTION_REQUESTED",
  "RESUBMITTED_PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
  "REVOKED",
] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

const TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  INVITED: ["IN_PROGRESS", "EXPIRED", "REVOKED"],
  IN_PROGRESS: ["SUBMITTED_PENDING_REVIEW", "WITHDRAWN", "EXPIRED"],
  SUBMITTED_PENDING_REVIEW: ["CORRECTION_REQUESTED", "APPROVED", "REJECTED"],
  CORRECTION_REQUESTED: ["RESUBMITTED_PENDING_REVIEW", "EXPIRED"],
  RESUBMITTED_PENDING_REVIEW: ["CORRECTION_REQUESTED", "APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
  WITHDRAWN: [],
  EXPIRED: [],
  REVOKED: [],
};

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

export function assertTransition(from: AssignmentStatus, to: AssignmentStatus): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new WorkflowError(`Cannot move an assignment from ${from} to ${to}.`);
  }
}

export function canVendorEdit(status: AssignmentStatus): boolean {
  return status === "INVITED" || status === "IN_PROGRESS" || status === "CORRECTION_REQUESTED";
}

export function isReviewable(status: AssignmentStatus): boolean {
  return status === "SUBMITTED_PENDING_REVIEW" || status === "RESUBMITTED_PENDING_REVIEW";
}

export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  INVITED: "Invited",
  IN_PROGRESS: "In progress",
  SUBMITTED_PENDING_REVIEW: "Pending review",
  CORRECTION_REQUESTED: "Correction requested",
  RESUBMITTED_PENDING_REVIEW: "Resubmitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
};
