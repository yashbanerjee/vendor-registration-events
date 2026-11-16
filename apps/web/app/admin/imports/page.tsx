"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { formatLabel } from "@/lib/utils";
import { Pager, usePagedRows } from "@/components/pager";
import { Button, ErrorNote, LoadingState, PageHeader, StatusBadge, UploadStatus, UploadTick } from "@/components/ui";

type Job = { id: string; filename: string; status: string; totalRows: number; createdCount: number; skippedCount: number; errorCount: number; rows?: { rowNumber: number; status: string; messages: string[] }[] };

export default function ImportsPage() {
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["imports"], queryFn: () => api<{ data: Job[] }>("/imports") });
  const detail = useQuery({ queryKey: ["import", active], queryFn: () => api<{ data: Job }>(`/imports/${active}`), enabled: Boolean(active) });
  const jobs = usePagedRows(list.data?.data ?? []);
  const resultRows = usePagedRows(detail.data?.data.rows ?? [], active ?? "");
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.set("file", file);
      return api<{ data: Job }>("/imports", { method: "POST", body });
    },
    onSuccess: async (result) => { setActive(result.data.id); setError(""); await client.invalidateQueries({ queryKey: ["imports"] }); },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Import failed."),
  });
  return (
    <div>
      <PageHeader title="Bulk import" description="Upload a CSV or Excel vendor list. Valid rows become vendor accounts, and each new contact receives a portal link and a temporary password. Configure the exhibition form next, then review submissions." actions={<Button asChild><a href="/api/v1/imports/template">Download template</a></Button>} />
      <ErrorNote className="mb-3" message={error} />
      <label className="block text-sm font-medium sm:max-w-md">
        Upload file
        <input className="mt-1.5 block text-sm" type="file" accept=".csv,.xlsx" disabled={upload.isPending} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) upload.mutate(file); }} />
      </label>
      <div className="mt-2 flex items-center gap-2">
        <UploadStatus pending={upload.isPending} />
        {upload.isSuccess && !upload.isPending ? <span className="inline-flex items-center gap-1.5 text-sm text-[var(--success)]"><UploadTick /> Uploaded</span> : null}
      </div>
      {list.isLoading ? <LoadingState label="Loading imports…" description="Fetching recent import jobs." /> : null}
      <div className="table-wrap mt-4">
        <table className="data">
          <thead><tr><th>File</th><th>Status</th><th>Created</th><th>Skipped</th><th>Errors</th></tr></thead>
          <tbody>
            {jobs.rows.map((job) => (
              <tr key={job.id}>
                <td><button className="max-w-full break-words text-left underline" onClick={() => setActive(job.id)}>{job.filename}</button></td>
                <td data-label="Status"><StatusBadge status={job.status} /></td>
                <td data-label="Created">{job.createdCount}</td>
                <td data-label="Skipped">{job.skippedCount}</td>
                <td data-label="Errors">{job.errorCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={jobs.page} pageCount={jobs.pageCount} total={jobs.total} rangeStart={jobs.rangeStart} rangeEnd={jobs.rangeEnd} onPage={jobs.setPage} />
      {detail.data ? (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Row results</h2>
            <Button onClick={() => { window.location.href = `/api/v1/imports/${detail.data.data.id}/errors.csv`; }}>Download error report</Button>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Row</th><th>Status</th><th>Messages</th></tr></thead>
              <tbody>
                {resultRows.rows.map((row) => (
                  <tr key={row.rowNumber}><td data-label="Row">{row.rowNumber}</td><td data-label="Status">{formatLabel(row.status)}</td><td data-label="Messages" data-stack>{row.messages.join(" ")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={resultRows.page} pageCount={resultRows.pageCount} total={resultRows.total} rangeStart={resultRows.rangeStart} rangeEnd={resultRows.rangeEnd} onPage={resultRows.setPage} />
        </div>
      ) : null}
    </div>
  );
}
