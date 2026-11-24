"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/errors";
import { formatDate, formatLabel } from "@/lib/utils";
import { FileLink } from "@/components/file-preview";
import { Pager, usePagedRows } from "@/components/pager";
import { EmptyState, ErrorNote, LoadingState, StatusBadge } from "@/components/ui";

type Row = {
  id: string;
  status: string;
  category: string;
  active?: boolean;
  replaced?: boolean;
  createdAt?: string;
  archivedAt?: string | null;
  versions: { filename: string }[];
};

export default function VendorDocumentsPage() {
  const query = useQuery({ queryKey: ["my-documents"], queryFn: () => api<{ data: Row[] }>("/documents?limit=100") });
  const documents = usePagedRows(query.data?.data ?? []);
  return (
    <div className="grid gap-5 [&>*]:min-w-0">
      <header className="grid gap-2">
        <h1 className="brand-page-title">My files</h1>
        <p className="text-sm leading-6 text-muted">
          Files your company has uploaded. When an organizer asks for a new copy and you replace a file, the old one stays listed as Replaced and the newest one as Active.
        </p>
      </header>

      <ErrorNote message={query.isError ? friendlyErrorMessage(query.error, "Could not load your files. Please refresh and try again.") : ""} />
      {query.isLoading ? <LoadingState label="Loading your files…" description="Gathering uploads for your company." /> : null}
      {query.isSuccess && documents.total === 0 ? (
        <EmptyState title="No files yet" body="Files you upload with a form will be listed here." />
      ) : null}
      {documents.total > 0 ? (
        <section className="brand-list-card !p-0 overflow-hidden">
          <div className="table-wrap !rounded-none !border-0 !shadow-none">
            <table className="data">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Category</th>
                  <th>Uploaded</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {documents.rows.map((row) => {
                  const filename = row.versions[0]?.filename;
                  const canOpen = (row.status === "AVAILABLE" || row.status === "REPLACED") && filename;
                  return (
                    <tr key={row.id} className={row.status === "REPLACED" ? "opacity-80" : undefined}>
                      <td className="break-words sm:max-w-[28rem]">
                        {canOpen ? <FileLink documentId={row.id} filename={filename} /> : <span>{filename || "Untitled file"}</span>}
                        {row.status === "REPLACED" ? (
                          <p className="mt-1 text-xs text-muted">Replaced by a newer upload. Use the Active file for this field.</p>
                        ) : null}
                      </td>
                      <td data-label="Category">{formatLabel(row.category)}</td>
                      <td data-label="Uploaded">{formatDate(row.createdAt)}</td>
                      <td data-label="Status">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[var(--border)] px-4 py-3 sm:px-6">
            <Pager page={documents.page} pageCount={documents.pageCount} total={documents.total} rangeStart={documents.rangeStart} rangeEnd={documents.rangeEnd} onPage={documents.setPage} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
