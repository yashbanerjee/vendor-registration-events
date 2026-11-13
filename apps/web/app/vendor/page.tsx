"use client";

import { fieldAnswers } from "@vmp/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/errors";
import { PacketCard, type Packet } from "@/components/vendor-packets";
import type { VendorAssignment } from "@/components/vendor-assignment-form";
import { Button, EmptyState, ErrorNote, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function VendorHomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading your form…</p>}>
      <MasterForm />
    </Suspense>
  );
}

function MasterForm() {
  const submitted = useSearchParams().get("submitted") === "1";
  const client = useQueryClient();
  const assignments = useQuery({ queryKey: ["my-assignments"], queryFn: () => api<{ data: VendorAssignment[] }>("/assignments") });
  const packets = useQuery({ queryKey: ["my-pdf-forms"], queryFn: () => api<{ data: Packet[] }>("/my/pdf-forms") });
  const forms = (assignments.data?.data ?? []).filter((assignment) => assignment.status !== "REVOKED");
  const pdfs = packets.data?.data ?? [];
  const profile = forms[0];
  const loading = assignments.isLoading || packets.isLoading;
  const failed = assignments.isError || packets.isError;

  return (
    <div className="grid gap-4">
      <PageHeader title="Your form" description="Each form shows how many questions are finished. Press Continue to fill one in, then Send when it is ready." />
      <Notice message={submitted ? "Your form was submitted." : ""} />
      <ErrorNote
        message={
          !loading && failed
            ? friendlyErrorMessage(assignments.error ?? packets.error, "Could not load your form. Please refresh the page and try again.")
            : ""
        }
      />
      {loading ? <p className="text-sm text-muted">Loading your form…</p> : null}
      {profile ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{profile.vendor.reference}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{profile.vendor.companyName}</h2>
          <dl className="mt-4 grid items-start gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Contact" value={profile.vendor.contactName} />
            <Detail label="Email" value={profile.vendor.email} />
            <Detail label="Phone" value={profile.vendor.phone || "Not provided"} />
            <Detail label="Category" value={profile.vendor.category || "Not provided"} />
          </dl>
        </section>
      ) : null}
      {!loading && !failed && forms.length === 0 && pdfs.length === 0 ? (
        <EmptyState title="No form yet" body="When an organizer assigns your registration form, the fields will appear here." />
      ) : null}
      {forms.map((assignment) => (
        <FormCard key={assignment.id} assignment={assignment} />
      ))}
      {pdfs.length > 0 ? (
        <section className="grid gap-4">
          <div>
            <h2 className="text-base font-semibold">PDF files</h2>
            <p className="mt-1 text-sm text-muted">Download the blank file, fill it in, and upload it here. Add any extra papers with a name, then press Send.</p>
          </div>
          {pdfs.map((form) => (
            <div key={form.id} id={`pdf-${form.id}`} className="scroll-mt-20">
              <PacketCard form={form} onChange={async () => { await client.invalidateQueries({ queryKey: ["my-pdf-forms"] }); }} />
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium leading-5">{value}</dd>
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
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{assignment.form.name}{assignment.form.versionNumber ? ` v${assignment.form.versionNumber}` : ""}</h2>
          <p className="mt-1 text-sm text-muted">
            {assignment.exhibition.name}
            {assignment.deadline ? ` · Due ${formatDate(assignment.deadline)}` : ""}
            {overdue ? " · Overdue" : ""}
          </p>
        </div>
        <StatusBadge status={assignment.status} />
      </div>
      <dl className="mt-4 grid items-start gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-2">
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">ID</dt>
          <dd className="mt-1 break-all text-xs leading-5">{assignment.id}</dd>
        </div>
        <Detail label="Total fields" value={String(total)} />
        <Detail label="Completed" value={`${completed} of ${total}`} />
      </dl>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${assignment.form.name} progress`}>
        <div className={`h-full ${percent === 100 ? "bg-[var(--success)]" : "bg-brand"}`} style={{ width: `${percent}%` }} />
      </div>
      {assignment.status === "CORRECTION_REQUESTED" ? (
        <p className="mt-3 text-sm text-[var(--badge-warning-fg)]">{corrections === 1 ? "1 question needs a change." : `${corrections} questions need a change.`}</p>
      ) : null}
      {assignment.status === "SUBMITTED_PENDING_REVIEW" || assignment.status === "RESUBMITTED_PENDING_REVIEW" ? (
        <p className="mt-3 text-sm text-muted">Sent{assignment.submittedAt ? ` ${formatDate(assignment.submittedAt)}` : ""}. The organizer will look at it.</p>
      ) : null}
      {assignment.status === "APPROVED" ? <p className="mt-3 text-sm text-muted">Accepted. This form cannot be changed.</p> : null}
      {assignment.status === "REJECTED" ? <p className="mt-3 text-sm text-muted">Not accepted.</p> : null}
      <div className="mt-4">
        <Button className="w-full sm:w-auto" variant={canContinue ? "primary" : "secondary"} asChild>
          <Link href={`/vendor/assignments/${assignment.id}`}>{canContinue ? "Continue" : "View"}</Link>
        </Button>
      </div>
    </section>
  );
}
