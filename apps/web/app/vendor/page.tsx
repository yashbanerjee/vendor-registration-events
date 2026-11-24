"use client";

import { fieldAnswers } from "@vmp/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/lib/api";
import { vendorErrorMessage } from "@/lib/errors";
import type { VendorAssignment } from "@/components/vendor-assignment-form";
import { Button, EmptyState, ErrorNote, LoadingState, Notice, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function VendorHomePage() {
  return (
    <Suspense fallback={<LoadingState label="Loading your form…" description="Fetching your registration details." />}>
      <MasterForm />
    </Suspense>
  );
}

function MasterForm() {
  const submitted = useSearchParams().get("submitted") === "1";
  const assignments = useQuery({ queryKey: ["my-assignments"], queryFn: () => api<{ data: VendorAssignment[] }>("/assignments") });
  const forms = (assignments.data?.data ?? []).filter((assignment) => assignment.status !== "REVOKED");
  const profile = forms[0];
  const loading = assignments.isLoading;
  const failed = assignments.isError;

  return (
    <div className="grid gap-5 [&>*]:min-w-0">
      <header className="grid gap-2">
        <h1 className="brand-page-title">Your form</h1>
        <p className="text-sm leading-6 text-muted">Each form shows how many questions are finished. Press Continue to fill one in, then Send when it is ready.</p>
      </header>

      <Notice message={submitted ? "Your form was submitted." : ""} />
      <ErrorNote
        message={
          !loading && failed
            ? vendorErrorMessage(assignments.error, "Could not load your form. Please refresh the page and try again.")
            : ""
        }
      />
      {loading ? <LoadingState label="Loading your form…" description="Fetching your registration details." /> : null}

      {profile ? (
        <section className="brand-list-card">
          <p className="eyebrow text-accent">Supplier/company</p>
          <h2 className="brand-list-title mt-2">{profile.vendor.companyName || profile.vendor.reference}</h2>
          <span className="brand-rule mt-3" aria-hidden />
          <dl className="mt-5 grid grid-cols-2 items-start gap-x-4 gap-y-4 border-t border-[var(--border)] pt-5 sm:gap-x-6 lg:grid-cols-3">
            <Detail label="Contact" value={profile.vendor.contactName} />
            <Detail label="Phone" value={profile.vendor.phone || "Not provided"} />
            <Detail wide label="Email" value={profile.vendor.email} />
          </dl>
        </section>
      ) : null}

      {!loading && !failed && forms.length === 0 ? (
        <EmptyState title="No form yet" body="When an organizer assigns your registration form, the fields will appear here." />
      ) : null}

      {forms.map((assignment) => (
        <FormCard key={assignment.id} assignment={assignment} />
      ))}
    </div>
  );
}

// `wide` gives long values (an email address) the full row on a phone.
function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 min-w-0 sm:col-span-1" : "min-w-0"}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium leading-5 text-[var(--heading)]">{value}</dd>
    </div>
  );
}

const OPEN_STATUSES = new Set(["INVITED", "IN_PROGRESS", "CORRECTION_REQUESTED"]);

function FormCard({ assignment }: { assignment: VendorAssignment }) {
  const answers = fieldAnswers(assignment.form.schema, assignment.values ?? {});
  const total = answers.length;
  const completed = answers.filter((answer) => answer.filled).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const canContinue = OPEN_STATUSES.has(assignment.status);
  const overdue = canContinue && assignment.deadline ? new Date(assignment.deadline).getTime() < Date.now() : false;
  const corrections = assignment.correction?.fields.length ?? 0;
  return (
    <section className="brand-list-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="brand-list-title">
            {assignment.form.name}
            {assignment.form.versionNumber ? ` v${assignment.form.versionNumber}` : ""}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {assignment.exhibition.name}
            {assignment.deadline ? ` · Due ${formatDate(assignment.deadline)}` : ""}
            {overdue ? " · Overdue" : ""}
          </p>
        </div>
        <StatusBadge status={assignment.status} />
      </div>
      <dl className="mt-5 grid grid-cols-2 items-start gap-x-4 gap-y-4 border-t border-[var(--border)] pt-5 sm:gap-x-6">
        <div className="col-span-2 min-w-0">
          <dt className="eyebrow">ID</dt>
          <dd className="mt-1 break-all text-xs leading-5 text-muted">{assignment.id}</dd>
        </div>
        <Detail label="Total fields" value={String(total)} />
        <Detail label="Completed" value={`${completed} of ${total}`} />
      </dl>
      <div
        className={`brand-progress mt-5 ${percent === 100 ? "is-complete" : ""}`}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${assignment.form.name} progress`}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      {assignment.status === "CORRECTION_REQUESTED" ? (
        <p className="mt-3 text-sm text-[var(--badge-warning-fg)]">{corrections === 1 ? "1 question needs a change." : `${corrections} questions need a change.`}</p>
      ) : null}
      {assignment.status === "SUBMITTED_PENDING_REVIEW" || assignment.status === "RESUBMITTED_PENDING_REVIEW" ? (
        <p className="mt-3 text-sm text-muted">Sent{assignment.submittedAt ? ` ${formatDate(assignment.submittedAt)}` : ""}. The organizer will look at it.</p>
      ) : null}
      {assignment.status === "APPROVED" ? <p className="mt-3 text-sm text-muted">Accepted. This form cannot be changed.</p> : null}
      {assignment.status === "REJECTED" ? <p className="mt-3 text-sm text-muted">Not accepted.</p> : null}
      <div className="mt-5">
        <Button className="w-full sm:w-auto" variant={canContinue ? "primary" : "secondary"} size="xl" asChild>
          <Link href={`/vendor/assignments/${assignment.id}`}>{canContinue ? "Continue" : "View"}</Link>

        </Button>
      </div>
    </section>
  );
}
