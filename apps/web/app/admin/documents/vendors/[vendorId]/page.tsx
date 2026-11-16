"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatLabel } from "@/lib/utils";
import { FileLink } from "@/components/file-preview";
import { Pager, usePagedRows } from "@/components/pager";
import { ErrorNote, LoadingState, PageHeader, StatusBadge } from "@/components/ui";

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
  if (!archive) {
    return query.isError
      ? <ErrorNote message="This archive could not be loaded." />
      : <LoadingState label="Loading archive…" description="Opening this company’s files." />;
  }
  const groups = new Map<string, typeof archive.documents>();
  for (const document of archive.documents) {
    const key = document.exhibition?.name ?? "Unassigned";
    groups.set(key, [...(groups.get(key) ?? []), document]);
  }
  return (
    <div>
      <PageHeader title={archive.vendor.companyName} description={`Document archive · ${archive.vendor.reference}`} />
      {groups.size === 0 ? <p className="text-sm text-muted">This company has not uploaded any files.</p> : null}
      {[...groups.entries()].map(([exhibition, documents]) => (
        <DocumentGroup key={exhibition} exhibition={exhibition} documents={documents} />
      ))}
    </div>
  );
}

function DocumentGroup({ exhibition, documents }: { exhibition: string; documents: Archive["data"]["documents"] }) {
  const page = usePagedRows(documents);
  return (
    <section className="mb-5">
      <h2 className="section-title">{exhibition}</h2>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>File</th><th>Form</th><th>Versions</th><th>Status</th></tr></thead>
          <tbody>
            {page.rows.map((document) => (
              <tr key={document.id}>
                <td>{document.versions[0]?.filename ? <FileLink documentId={document.id} filename={document.versions[0].filename} /> : document.category}</td>
                <td data-label="Form">{document.assignment?.formVersion.template.name ?? formatLabel(document.category)}</td>
                <td data-label="Versions">{document.versions.length}</td>
                <td data-label="Status"><StatusBadge status={document.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page.page} pageCount={page.pageCount} total={page.total} rangeStart={page.rangeStart} rangeEnd={page.rangeEnd} onPage={page.setPage} />
    </section>
  );
}
