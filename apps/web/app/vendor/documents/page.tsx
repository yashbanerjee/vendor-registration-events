"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/errors";
import { formatLabel } from "@/lib/utils";
import { FileLink } from "@/components/file-preview";
import { Pager, usePagedRows } from "@/components/pager";
import { ErrorNote, PageHeader, StatusBadge } from "@/components/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = { id: string; status: string; category: string; versions: { filename: string }[] };

export default function VendorDocumentsPage() {
  const query = useQuery({ queryKey: ["my-documents"], queryFn: () => api<{ data: Row[] }>("/documents?limit=100") });
  const documents = usePagedRows(query.data?.data ?? []);
  return (
    <div>
      <PageHeader title="My files" description="Files your company has uploaded." />
      <ErrorNote message={query.isError ? friendlyErrorMessage(query.error, "Could not load your files. Please refresh and try again.") : ""} />
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <Table className="table-fixed">
          <TableHeader className="bg-secondary">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[55%]">File</TableHead>
              <TableHead className="w-[25%]">Category</TableHead>
              <TableHead className="w-[20%]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-0">
                  <div className="min-w-0 max-w-full overflow-hidden">
                    {row.status !== "REJECTED" && row.versions[0]?.filename ? (
                      <FileLink documentId={row.id} filename={row.versions[0].filename} />
                    ) : (
                      <span className="block truncate text-sm" title={row.versions[0]?.filename}>{row.versions[0]?.filename}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="truncate">{formatLabel(row.category)}</TableCell>
                <TableCell><StatusBadge status={row.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pager page={documents.page} pageCount={documents.pageCount} total={documents.total} rangeStart={documents.rangeStart} rangeEnd={documents.rangeEnd} onPage={documents.setPage} />
    </div>
  );
}
