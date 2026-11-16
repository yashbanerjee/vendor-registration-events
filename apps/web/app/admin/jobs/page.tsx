"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, formatLabel } from "@/lib/utils";
import { Pager, usePagedRows } from "@/components/pager";
import { Button, LoadingState, PageHeader, StatusBadge } from "@/components/ui";

type Jobs = { data: { outbox: { id: string; type: string; status: string; attempts: number; lastError: string; createdAt: string }[]; emails: { id: string; toAddress: string; template: string; status: string; lastError: string; createdAt: string }[] } };

export default function JobsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["jobs"], queryFn: () => api<Jobs>("/jobs") });
  const outbox = usePagedRows(query.data?.data.outbox ?? []);
  const emails = usePagedRows(query.data?.data.emails ?? []);
  const retry = useMutation({
    mutationFn: (id: string) => api(`/jobs/${id}/retry`, { method: "POST" }),
    onSuccess: async () => client.invalidateQueries({ queryKey: ["jobs"] }),
  });
  return (
    <div>
      <PageHeader title="Background jobs" description="Pending mail stays in the queue and is sent one every 5 seconds. Sent means the mail server accepted the message. Delivered or bounced appears only after a provider event." />
      {query.isLoading ? <LoadingState label="Loading jobs…" description="Checking the email and outbox queues." /> : null}
      <h2 className="section-title">Outbox</h2>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Type</th><th>Status</th><th>Attempts</th><th>Error</th><th></th></tr></thead>
          <tbody>
            {outbox.rows.map((row) => (
              <tr key={row.id}>
                <td>{formatLabel(row.type)}</td>
                <td data-label="Status"><StatusBadge status={row.status} /></td>
                <td data-label="Attempts">{row.attempts}</td>
                <td data-label="Error" data-stack>{row.lastError}</td>
                {row.status === "FAILED"
                  ? <td><Button size="sm" onClick={() => retry.mutate(row.id)}>Retry</Button></td>
                  : <td data-label="Created" className="whitespace-nowrap">{formatDate(row.createdAt)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.data && outbox.total === 0 ? <p className="text-sm text-muted sm:mt-3">The outbox is empty.</p> : null}
      <Pager page={outbox.page} pageCount={outbox.pageCount} total={outbox.total} rangeStart={outbox.rangeStart} rangeEnd={outbox.rangeEnd} onPage={outbox.setPage} />
      <h2 className="section-title mt-5">Email</h2>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>To</th><th>Template</th><th>Status</th><th>When</th></tr></thead>
          <tbody>
            {emails.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.toAddress}</td>
                <td data-label="Template">{formatLabel(row.template)}</td>
                <td data-label="Status"><StatusBadge status={row.status} /></td>
                <td data-label="When" className="whitespace-nowrap">{formatDate(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.data && emails.total === 0 ? <p className="text-sm text-muted sm:mt-3">No email has been sent yet.</p> : null}
      <Pager page={emails.page} pageCount={emails.pageCount} total={emails.total} rangeStart={emails.rangeStart} rangeEnd={emails.rangeEnd} onPage={emails.setPage} />
    </div>
  );
}
