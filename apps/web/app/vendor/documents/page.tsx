"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge, PageHeader, statusTone } from "@/components/ui";

type Row = { id: string; status: string; category: string; versions: { filename: string }[] };

export default function VendorDocumentsPage() {
  const query = useQuery({ queryKey: ["my-documents"], queryFn: () => api<{ data: Row[] }>("/documents") });
  return (
    <div>
      <PageHeader title="Your documents" description="Only files uploaded for your company are listed." />
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>File</th><th>Category</th><th>Status</th></tr></thead>
          <tbody>
            {(query.data?.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.status === "AVAILABLE" ? <a className="underline" href={`/api/v1/documents/${row.id}/content`}>{row.versions[0]?.filename}</a> : row.versions[0]?.filename}</td>
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
