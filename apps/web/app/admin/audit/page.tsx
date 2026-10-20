"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, formatLabel } from "@/lib/utils";
import { PageHeader } from "@/components/ui";

type Audit = { id: string; action: string; actorRole: string; resourceType: string; createdAt: string; fieldId: string | null };

export default function AuditPage() {
  const query = useQuery({ queryKey: ["audit"], queryFn: () => api<{ data: Audit[] }>("/audit-logs") });
  return (
    <div>
      <PageHeader title="Audit trail" description="Append-only history of privileged actions, submissions, corrections, and document access." />
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>When</th><th>Action</th><th>Role</th><th>Resource</th><th>Field</th></tr></thead>
          <tbody>
            {(query.data?.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.createdAt)}</td>
                <td>{formatLabel(row.action)}</td>
                <td>{formatLabel(row.actorRole)}</td>
                <td>{formatLabel(row.resourceType)}</td>
                <td>{row.fieldId ? row.fieldId.slice(0, 8) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
