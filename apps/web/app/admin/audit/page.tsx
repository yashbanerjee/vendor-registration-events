"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, formatLabel } from "@/lib/utils";
import { Pager, usePagedRows } from "@/components/pager";
import { LoadingState, PageHeader } from "@/components/ui";

type Audit = { id: string; action: string; actorRole: string; resourceType: string; createdAt: string; fieldId: string | null };

export default function AuditPage() {
  const query = useQuery({ queryKey: ["audit"], queryFn: () => api<{ data: Audit[] }>("/audit-logs") });
  const audits = usePagedRows(query.data?.data ?? []);
  return (
    <div>
      <PageHeader title="Audit trail" description="Append-only history of privileged actions, submissions, corrections, and document access." />
      {query.isLoading ? <LoadingState label="Loading audit trail…" description="Fetching recent activity." /> : null}
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>When</th><th>Action</th><th>Role</th><th>Resource</th><th>Field</th></tr></thead>
          <tbody>
            {audits.rows.map((row) => (
              <tr key={row.id}>
                <td data-label="When" className="whitespace-nowrap">{formatDate(row.createdAt)}</td>
                <td data-label="Action">{formatLabel(row.action)}</td>
                <td data-label="Role">{formatLabel(row.actorRole)}</td>
                <td data-label="Resource">{formatLabel(row.resourceType)}</td>
                <td data-label="Field">{row.fieldId ? row.fieldId.slice(0, 8) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={audits.page} pageCount={audits.pageCount} total={audits.total} rangeStart={audits.rangeStart} rangeEnd={audits.rangeEnd} onPage={audits.setPage} />
    </div>
  );
}
