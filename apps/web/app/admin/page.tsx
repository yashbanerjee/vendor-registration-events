"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Badge, PageHeader, statusTone } from "@/components/ui";

type Dashboard = {
  data: {
    counts: Record<string, number>;
    byStatus: { status: string; count: number }[];
    recentSubmissions: { id: string; vendor: string; form: string; status: string; submittedAt: string }[];
    deadlines: { id: string; vendor: string; exhibition: string; deadline: string; status: string }[];
    activity: { id: string; action: string; createdAt: string }[];
  };
};

const cards = [
  ["vendors", "Vendors"],
  ["invited", "Invited"],
  ["incomplete", "Incomplete"],
  ["pendingReview", "Pending review"],
  ["corrections", "Corrections"],
  ["resubmissions", "Resubmissions"],
  ["approved", "Approved"],
  ["overdue", "Overdue"],
  ["failedEmails", "Failed emails"],
  ["pendingDocuments", "Documents scanning"],
] as const;

export default function DashboardPage() {
  const query = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard") });
  const data = query.data?.data;
  return (
    <div>
      <PageHeader title="Operations" description="Live counts from your organization. Email status stays Sent until a provider delivery event arrives." />
      {query.isLoading ? <p className="text-sm text-muted">Loading metrics…</p> : null}
      {query.isError ? <p className="text-sm text-danger">Metrics could not be loaded.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([key, label]) => (
          <div key={key} className="rounded-lg border border-border bg-surface px-3 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className="text-2xl font-semibold">{data?.counts[key] ?? "—"}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-border bg-surface p-3">
          <h2 className="mb-2 text-sm font-semibold">Assignments by status</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.byStatus ?? []}>
                <XAxis dataKey="status" interval={0} tick={{ fontSize: 10 }} height={48} />
                <YAxis allowDecimals={false} width={28} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--brand)" radius={3} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-lg border border-border bg-surface p-3">
          <h2 className="mb-2 text-sm font-semibold">Recent activity</h2>
          <ul className="grid gap-2 text-sm">
            {(data?.activity ?? []).map((item) => (
              <li key={item.id} className="flex justify-between gap-3 border-b border-border pb-2">
                <span>{item.action}</span>
                <span className="text-muted">{formatDate(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Recent submissions</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Vendor</th><th>Form</th><th>Status</th></tr></thead>
              <tbody>
                {(data?.recentSubmissions ?? []).map((row) => (
                  <tr key={row.id}>
                    <td><Link className="font-medium underline" href={`/admin/reviews/${row.id}`}>{row.vendor}</Link></td>
                    <td>{row.form}</td>
                    <td><Badge tone={statusTone(row.status)}>{row.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold">Upcoming deadlines</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Vendor</th><th>Exhibition</th><th>Due</th></tr></thead>
              <tbody>
                {(data?.deadlines ?? []).map((row) => (
                  <tr key={row.id}><td>{row.vendor}</td><td>{row.exhibition}</td><td>{formatDate(row.deadline)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
