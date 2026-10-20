"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, formatLabel } from "@/lib/utils";
import { Button, PageHeader, StatusBadge } from "@/components/ui";

type Jobs = { data: { outbox: { id: string; type: string; status: string; attempts: number; lastError: string; createdAt: string }[]; emails: { id: string; toAddress: string; template: string; status: string; lastError: string; createdAt: string }[] } };

export default function JobsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["jobs"], queryFn: () => api<Jobs>("/jobs") });
  const retry = useMutation({
    mutationFn: (id: string) => api(`/jobs/${id}/retry`, { method: "POST" }),
    onSuccess: async () => client.invalidateQueries({ queryKey: ["jobs"] }),
  });
  return (
    <div>
      <PageHeader title="Background jobs" description="Sent means the mail server accepted the message. Delivered or bounced appears only after a provider event." />
      <h2 className="mb-2 text-sm font-semibold">Outbox</h2>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Type</th><th>Status</th><th>Attempts</th><th>Error</th><th></th></tr></thead>
          <tbody>
            {(query.data?.data.outbox ?? []).map((row) => (
              <tr key={row.id}>
                <td>{formatLabel(row.type)}</td>
                <td><StatusBadge status={row.status} /></td>
                <td>{row.attempts}</td>
                <td>{row.lastError}</td>
                <td>{row.status === "FAILED" ? <Button size="sm" onClick={() => retry.mutate(row.id)}>Retry</Button> : formatDate(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mb-2 mt-4 text-sm font-semibold">Email</h2>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>To</th><th>Template</th><th>Status</th><th>When</th></tr></thead>
          <tbody>
            {(query.data?.data.emails ?? []).map((row) => (
              <tr key={row.id}><td>{row.toAddress}</td><td>{formatLabel(row.template)}</td><td><StatusBadge status={row.status} /></td><td>{formatDate(row.createdAt)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
