"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatLabel } from "@/lib/utils";
import { FileLink } from "@/components/file-preview";
import { PageHeader, StatusBadge } from "@/components/ui";

type Archive = {
  data: {
    vendor: { companyName: string; reference: string };
    documents: { id: string; status: string; category: string; fieldId: string | null; exhibition: { name: string } | null; assignment: { formVersion: { template: { name: string } } } | null; versions: { filename: string; versionNumber: number; createdAt: string }[] }[];
  };
};

export default function VendorArchivePage() {
  const params = useParams<{ vendorId: string }>();
  const query = useQuery({ queryKey: ["archive", params.vendorId], queryFn: () => api<Archive>(`/documents/archive/${params.vendorId}`) });
  const archive = query.data?.data;
  if (!archive) return <p className="text-sm text-muted">Loading archive…</p>;
  const groups = new Map<string, typeof archive.documents>();
  for (const document of archive.documents) {
    const key = document.exhibition?.name ?? "Unassigned";
    groups.set(key, [...(groups.get(key) ?? []), document]);
  }
  return (
    <div>
      <PageHeader title={archive.vendor.companyName} description={`Document archive · ${archive.vendor.reference}`} />
      {[...groups.entries()].map(([exhibition, documents]) => (
        <section key={exhibition} className="mb-4">
          <h2 className="mb-2 text-sm font-semibold">{exhibition}</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>File</th><th>Form</th><th>Versions</th><th>Status</th></tr></thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td>{document.versions[0]?.filename ? <FileLink documentId={document.id} filename={document.versions[0].filename} /> : document.category}</td>
                    <td>{document.assignment?.formVersion.template.name ?? formatLabel(document.category)}</td>
                    <td>{document.versions.length}</td>
                    <td><StatusBadge status={document.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
