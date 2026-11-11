"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Pager, usePagedRows } from "@/components/pager";
import { PageHeader, StatusBadge } from "@/components/ui";

type ErrorRow = {
  id: string;
  source: string;
  method: string;
  path: string;
  statusCode: number | null;
  code: string;
  message: string;
  details: unknown;
  userEmail: string;
  userName: string;
  companyName: string;
  vendorId: string | null;
  correlationId: string;
  userAgent: string;
  alertedAt: string | null;
  createdAt: string;
};

type ErrorsResponse = { data: ErrorRow[] };

export default function ErrorsPage() {
  const query = useQuery({
    queryKey: ["client-errors"],
    queryFn: () => api<ErrorsResponse>("/client-errors"),
    refetchInterval: 15_000,
  });
  const rows = usePagedRows(query.data?.data ?? []);

  return (
    <div>
      <PageHeader
        title="API & upload errors"
        description="Failed uploads and API errors are saved here and emailed to info@vedha.ae and saadbhati1002@gmail.com with the affected user details."
      />
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Request</th>
              <th>Error</th>
              <th>Alert</th>
            </tr>
          </thead>
          <tbody>
            {rows.rows.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap align-top">{formatDate(row.createdAt)}</td>
                <td className="align-top">
                  <div className="grid gap-0.5 text-sm">
                    <span className="font-medium">{row.userName || "Unknown user"}</span>
                    <span>{row.userEmail || "—"}</span>
                    <span className="text-muted">{row.companyName || "—"}</span>
                  </div>
                </td>
                <td className="align-top">
                  <div className="grid gap-0.5 text-sm">
                    <span className="font-medium">{row.method ? `${row.method} ${row.path}` : row.path}</span>
                    <span className="text-muted">
                      {row.source}
                      {row.statusCode != null ? ` · ${row.statusCode}` : ""}
                      {row.code ? ` · ${row.code}` : ""}
                    </span>
                    {row.correlationId ? <span className="text-xs text-muted">{row.correlationId}</span> : null}
                  </div>
                </td>
                <td className="align-top">
                  <div className="grid max-w-xl gap-1 text-sm">
                    <span>{row.message}</span>
                    {row.details != null ? (
                      <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-secondary p-2 text-xs text-muted">{JSON.stringify(row.details, null, 2)}</pre>
                    ) : null}
                  </div>
                </td>
                <td className="align-top">
                  {row.alertedAt ? <StatusBadge status="SENT" /> : <StatusBadge status="QUEUED" />}
                </td>
              </tr>
            ))}
            {!rows.rows.length ? (
              <tr>
                <td colSpan={5} className="text-sm text-muted">No errors recorded yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager page={rows.page} pageCount={rows.pageCount} total={rows.total} rangeStart={rows.rangeStart} rangeEnd={rows.rangeEnd} onPage={rows.setPage} />
    </div>
  );
}
