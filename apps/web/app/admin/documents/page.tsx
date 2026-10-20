"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { Badge, PageHeader, inputClass, statusTone } from "@/components/ui";

type DocumentRow = { id: string; status: string; category: string; vendor: { id: string; companyName: string }; versions: { filename: string; sizeBytes: number }[] };

export default function DocumentsPage() {
  const [q, setQ] = useState("");
  const query = useQuery({ queryKey: ["documents", q], queryFn: () => api<{ data: DocumentRow[] }>(`/documents?q=${encodeURIComponent(q)}`) });
  return (
    <div>
      <PageHeader title="Document archive" description="Files stay private. Downloads are authorized on each request." />
      <input className={`${inputClass} mb-3 max-w-sm`} aria-label="Search documents" placeholder="Search by filename" value={q} onChange={(event) => setQ(event.target.value)} />
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>File</th><th>Vendor</th><th>Category</th><th>Status</th></tr></thead>
          <tbody>
            {(query.data?.data ?? []).map((row) => (
              <tr key={row.id}>
                <td><a className="underline" href={`/api/v1/documents/${row.id}/content`}>{row.versions[0]?.filename ?? "File"}</a></td>
                <td><Link className="underline" href={`/admin/documents/vendors/${row.vendor.id}`}>{row.vendor.companyName}</Link></td>
                <td>{row.category}</td>
                <td><Badge tone={statusTone(row.status)}>{row.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
