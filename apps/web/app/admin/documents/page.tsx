"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { FileLink } from "@/components/file-preview";
import { Pager, usePagedRows } from "@/components/pager";
import { FilterBar, LoadingState, PageHeader, StatusBadge, inputClass } from "@/components/ui";

type DocumentRow = { id: string; status: string; vendor: { id: string; companyName: string }; versions: { filename: string; sizeBytes: number }[] };

export default function DocumentsPage() {
  const [q, setQ] = useState("");
  const query = useQuery({ queryKey: ["documents", q], queryFn: () => api<{ data: DocumentRow[] }>(`/documents?limit=100&q=${encodeURIComponent(q)}`) });
  const documents = usePagedRows(query.data?.data ?? [], q);
  return (
    <div>
      <PageHeader title="Document archive" description="Files stay private. Downloads are authorized on each request." />
      <FilterBar>
        <input className={`${inputClass} col-span-2 sm:max-w-sm`} aria-label="Search documents" placeholder="Search by filename" value={q} onChange={(event) => setQ(event.target.value)} />
      </FilterBar>
      {query.isLoading ? <LoadingState label="Loading documents…" description="Gathering the file archive." /> : null}
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>File</th><th>Vendor</th><th>Status</th></tr></thead>
          <tbody>
            {documents.rows.map((row) => (
              <tr key={row.id}>
                <td><FileLink documentId={row.id} filename={row.versions[0]?.filename ?? "File"} /></td>
                <td data-label="Vendor"><Link className="underline" href={`/admin/documents/vendors/${row.vendor.id}`}>{row.vendor.companyName}</Link></td>
                <td data-label="Status"><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!query.isLoading && documents.total === 0 ? <p className="text-sm text-muted sm:mt-3">No files match this search.</p> : null}
      <Pager page={documents.page} pageCount={documents.pageCount} total={documents.total} rangeStart={documents.rangeStart} rangeEnd={documents.rangeEnd} onPage={documents.setPage} />
    </div>
  );
}
