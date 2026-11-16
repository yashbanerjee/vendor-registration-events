"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/errors";
import { formatLabel } from "@/lib/utils";
import { FileLink } from "@/components/file-preview";
import { Pager, usePagedRows } from "@/components/pager";
import { EmptyState, ErrorNote, LoadingState, PageHeader, StatusBadge } from "@/components/ui";

type Row = { id: string; status: string; category: string; versions: { filename: string }[] };

export default function VendorDocumentsPage() {
  const query = useQuery({ queryKey: ["my-documents"], queryFn: () => api<{ data: Row[] }>("/documents?limit=100") });
  const documents = usePagedRows(query.data?.data ?? []);
  return (
    <div>
      <PageHeader title="My files" description="Files your company has uploaded." />
      <ErrorNote className="mb-3" message={query.isError ? friendlyErrorMessage(query.error, "Could not load your files. Please refresh and try again.") : ""} />
      {query.isLoading ? <LoadingState label="Loading your files…" description="Gathering uploads for your company." /> : null}
      {query.isSuccess && documents.total === 0 ? (
        <EmptyState title="No files yet" body="Files you upload with a form will be listed here." />
      ) : null}
      {documents.total > 0 ? (
        <>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>File</th><th>Category</th><th>Status</th></tr></thead>
              <tbody>
                {documents.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="break-words sm:max-w-[28rem]">
                      {row.status !== "REJECTED" && row.versions[0]?.filename ? (
                        <FileLink documentId={row.id} filename={row.versions[0].filename} />
                      ) : (
                        <span>{row.versions[0]?.filename}</span>
                      )}
                    </td>
                    <td data-label="Category">{formatLabel(row.category)}</td>
                    <td data-label="Status"><StatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={documents.page} pageCount={documents.pageCount} total={documents.total} rangeStart={documents.rangeStart} rangeEnd={documents.rangeEnd} onPage={documents.setPage} />
        </>
      ) : null}
    </div>
  );
}
