"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Pager, usePagedRows } from "@/components/pager";
import { ErrorNote, LoadingState, PageHeader, StatCard, StatGrid, StatusBadge } from "@/components/ui";

type Dashboard = {
  data: {
    counts: Record<string, number>;
    byStatus: { status: string; count: number }[];
    recentSubmissions: { id: string; vendor: string; form: string; status: string; submittedAt: string }[];
    deadlines: { id: string; vendor: string; exhibition: string; deadline: string; status: string }[];
    activity: { id: string; action: string; createdAt: string; actorName: string }[];
  };
};

export default function DashboardPage() {
  const query = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard") });
  const data = query.data?.data;
  const submissions = usePagedRows(data?.recentSubmissions ?? []);
  const deadlines = usePagedRows(data?.deadlines ?? []);
  const counts = data?.counts;
  return (
    <div>
      <PageHeader title="Home" description="Overview of submissions, deadlines, and review work." />
      {query.isLoading ? <LoadingState label="Loading dashboard…" description="Gathering the latest activity." /> : null}
      <ErrorNote className="mb-3" message={query.isError ? "The home page could not be loaded." : ""} />
      <StatGrid>
        <StatCard label="Waiting for you" value={counts?.pendingReview ?? "—"} />
        <StatCard label="Not finished" value={counts?.incomplete ?? "—"} />
        <StatCard label="Late" value={counts?.overdue ?? "—"} />
        <StatCard label="Accepted" value={counts?.approved ?? "—"} />
      </StatGrid>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="min-w-0">
          <h2 className="section-title">Just sent in</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Company</th><th>Form</th><th>Status</th></tr></thead>
              <tbody>
                {submissions.rows.map((row) => {
                  const waiting = row.status === "SUBMITTED_PENDING_REVIEW" || row.status === "RESUBMITTED_PENDING_REVIEW";
                  return (
                    <tr key={row.id} className={waiting ? "bg-[var(--badge-warning-bg)]" : undefined}>
                      <td><Link className="font-medium underline" href={`/admin/reviews/${row.id}`}>{row.vendor}</Link></td>
                      <td data-label="Form">{row.form}</td>
                      <td data-label="Status"><StatusBadge status={row.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data && submissions.total === 0 ? <p className="text-sm text-muted sm:mt-3">Nothing has been sent in yet.</p> : null}
          <Pager page={submissions.page} pageCount={submissions.pageCount} total={submissions.total} rangeStart={submissions.rangeStart} rangeEnd={submissions.rangeEnd} onPage={submissions.setPage} />
        </section>
        <section className="min-w-0">
          <h2 className="section-title">Due soon</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Company</th><th>Event</th><th>Due</th></tr></thead>
              <tbody>
                {deadlines.rows.map((row) => (
                  <tr key={row.id}><td>{row.vendor}</td><td data-label="Event">{row.exhibition}</td><td data-label="Due">{formatDate(row.deadline)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && deadlines.total === 0 ? <p className="text-sm text-muted sm:mt-3">No deadlines are coming up.</p> : null}
          <Pager page={deadlines.page} pageCount={deadlines.pageCount} total={deadlines.total} rangeStart={deadlines.rangeStart} rangeEnd={deadlines.rangeEnd} onPage={deadlines.setPage} />
        </section>
      </div>
    </div>
  );
}
