"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatLabel } from "@/lib/utils";
import { FileLink } from "@/components/file-preview";
import { Pager, usePagedRows } from "@/components/pager";
import { PageHeader, StatusBadge } from "@/components/ui";

type Row = { id: string; status: string; category: string; versions: { filename: string }[] };

export default function VendorDocumentsPage() {
  const query = useQuery({ queryKey: ["my-documents"], queryFn: () => api<{ data: Row[] }>("/documents?limit=100") });
  const documents = usePagedRows(query.data?.data ?? []);
  return (
    <div>
      <PageHeader title="My files" description="Files your company has uploaded." />
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>File</th><th>Category</th><th>Status</th></tr></thead>
          <tbody>
            {documents.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.status === "AVAILABLE" && row.versions[0]?.filename ? <FileLink documentId={row.id} filename={row.versions[0].filename} /> : row.versions[0]?.filename}</td>
                <td>{formatLabel(row.category)}</td>
                <td><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={documents.page} pageCount={documents.pageCount} total={documents.total} rangeStart={documents.rangeStart} rangeEnd={documents.rangeEnd} onPage={documents.setPage} />
    </div>
  );
}
