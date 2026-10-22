"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Pager, usePagedRows } from "@/components/pager";
import { ErrorNote, PageHeader, StatusBadge } from "@/components/ui";

type Dashboard = {
  data: {
    counts: Record<string, number>;
    byStatus: { status: string; count: number }[];
    recentSubmissions: { id: string; vendor: string; form: string; status: string; submittedAt: string }[];
    deadlines: { id: string; vendor: string; exhibition: string; deadline: string; status: string }[];
    activity: { id: string; action: string; createdAt: string; actorName: string }[];
  };
};

const steps = [
  ["1", "Add an event", "Name the show, the place, and the dates.", "/admin/exhibitions"],
  ["2", "Add companies", "Put in each company and the person who will fill the form.", "/admin/vendors"],
  ["3", "Prepare the form", "Write the questions, or upload a PDF on the event.", "/admin/forms"],
  ["4", "Check what comes back", "Open an answer, accept it, or ask them to fix it.", "/admin/reviews"],
] as const;

export default function DashboardPage() {
  const query = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard") });
  const data = query.data?.data;
  const submissions = usePagedRows(data?.recentSubmissions ?? []);
  const deadlines = usePagedRows(data?.deadlines ?? []);
  const counts = data?.counts;
  return (
    <div>
      <PageHeader title="Home" description="Four steps. Start at the top and work down." />
      {query.isLoading ? <p className="text-sm text-muted">Loading…</p> : null}
      <ErrorNote message={query.isError ? "The home page could not be loaded." : ""} />
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map(([number, title, body, href]) => (
          <li key={number}>
            <Link href={href} className="block h-full rounded-lg border border-border bg-surface p-4 hover:bg-secondary">
              <span className="text-sm font-semibold text-brand">Step {number}</span>
              <span className="mt-1 block font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-muted">{body}</span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Count label="Waiting for you" value={counts?.pendingReview} />
        <Count label="Not finished" value={counts?.incomplete} />
        <Count label="Late" value={counts?.overdue} />
        <Count label="Accepted" value={counts?.approved} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Just sent in</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Company</th><th>Form</th><th>Status</th></tr></thead>
              <tbody>
                {submissions.rows.map((row) => {
                  const waiting = row.status === "SUBMITTED_PENDING_REVIEW" || row.status === "RESUBMITTED_PENDING_REVIEW";
                  return (
                    <tr key={row.id} className={waiting ? "bg-[var(--badge-warning-bg)]" : undefined}>
                      <td><Link className="font-medium underline" href={`/admin/reviews/${row.id}`}>{row.vendor}</Link></td>
                      <td>{row.form}</td>
                      <td><StatusBadge status={row.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={submissions.page} pageCount={submissions.pageCount} total={submissions.total} rangeStart={submissions.rangeStart} rangeEnd={submissions.rangeEnd} onPage={submissions.setPage} />
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold">Due soon</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Company</th><th>Event</th><th>Due</th></tr></thead>
              <tbody>
                {deadlines.rows.map((row) => (
                  <tr key={row.id}><td>{row.vendor}</td><td>{row.exhibition}</td><td>{formatDate(row.deadline)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={deadlines.page} pageCount={deadlines.pageCount} total={deadlines.total} rangeStart={deadlines.rangeStart} rangeEnd={deadlines.rangeEnd} onPage={deadlines.setPage} />
        </section>
      </div>
    </div>
  );
}

function Count({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold">{value ?? "—"}</p>
    </div>
  );
}
