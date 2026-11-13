"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { api, download } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/errors";
import { RemoteFileLink } from "@/components/file-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNote, Field, StatusBadge, UploadStatus, UploadTick, inputClass } from "@/components/ui";

type PacketFile = { id: string; name: string; filename: string; status: string; adminNote: string };
export type Packet = {
  id: string;
  name: string;
  filename: string;
  exhibition: { id: string; name: string; venue: string };
  returnId: string | null;
  status: string;
  filledName: string;
  adminNote: string;
  files: PacketFile[];
};

export function PacketCard({ form, onChange }: { form: Packet; onChange: () => Promise<void> }) {
  const client = useQueryClient();
  const locked = form.status === "SUBMITTED";
  const docRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [docName, setDocName] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const run = useMutation({
    mutationFn: async (job: { kind: string; task: () => Promise<unknown> }) => job.task(),
    onSuccess: async (result) => {
      setError("");
      setDocName("");
      setDocFile(null);
      if (docRef.current) docRef.current.value = "";
      if (result && typeof result === "object" && "data" in result) client.setQueryData(["my-pdf-forms"], result);
      await onChange();
    },
    onError: (caught) => setError(friendlyErrorMessage(caught, "Could not save that file. Please try again.")),
  });
  const busy = run.isPending ? run.variables?.kind ?? "" : "";
  const step = locked ? 4 : form.files.length ? 3 : form.filledName ? 2 : 0;

  function uploadFilled(file: File | null) {
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    run.mutate({ kind: "filled", task: () => api(`/my/pdf-forms/${form.id}/filled`, { method: "POST", body }) });
  }

  function uploadDocument(event: React.FormEvent) {
    event.preventDefault();
    if (!docFile) return;
    const body = new FormData();
    body.set("name", docName);
    body.set("file", docFile);
    run.mutate({ kind: "document", task: () => api(`/my/pdf-forms/${form.id}/documents`, { method: "POST", body }) });
  }

  return (
    <Card className="overflow-hidden bg-secondary">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <CardTitle className="min-w-0 truncate" title={form.name}>{form.name}</CardTitle>
            <StatusBadge status={form.status === "AWAITING" && form.filledName ? "READY" : form.status} />
          </div>
          {form.exhibition.name ? <CardDescription>{form.exhibition.name}</CardDescription> : null}
          <ol className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
            {["Get the form", "Upload it", "Add papers", "Send"].map((label, index) => (
              <li key={label} className={`rounded-full px-2.5 py-1 ${index < step ? "bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]" : "bg-surface text-muted ring-1 ring-border"}`}>{index + 1} {label}</li>
            ))}
          </ol>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => void download(`/pdf-forms/${form.id}/file?disposition=attachment`, form.filename).catch((caught) => setError(friendlyErrorMessage(caught, "The download failed. Please try again.")))}>
          <Download size={14} aria-hidden />
          Download form
        </Button>
      </CardHeader>
      <CardContent>
      {form.filledName && form.returnId ? (
        <p className="mb-3 flex min-w-0 items-center gap-2 text-sm text-muted">
          <UploadTick />
          <span className="min-w-0 truncate">Filled copy: <RemoteFileLink path={`/pdf-returns/${form.returnId}/file`} filename={form.filledName} /></span>
        </p>
      ) : null}
      {form.adminNote ? <p className="mb-3 rounded-md bg-[var(--badge-warning-bg)] px-3 py-2 text-sm">Replace this form. {form.adminNote}</p> : null}
      <ErrorNote message={error} />
      {!locked ? (
        <div className="mt-4 grid gap-4">
          <Field label="Upload the filled PDF">
            <input type="file" accept="application/pdf,.pdf" disabled={run.isPending} onChange={(event) => uploadFilled(event.target.files?.[0] ?? null)} />
            <UploadStatus pending={busy === "filled"} />
          </Field>
          <form className="grid min-w-0 items-start gap-3 rounded-md border border-border bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" onSubmit={uploadDocument}>
            <Field label="Document name"><input className={inputClass} value={docName} onChange={(event) => setDocName(event.target.value)} placeholder="Trade license" /></Field>
            <Field label="File">
              <input ref={docRef} type="file" disabled={run.isPending} onChange={(event) => setDocFile(event.target.files?.[0] ?? null)} />
            </Field>
            <Button type="submit" size="sm" disabled={run.isPending || !docName.trim() || !docFile}>
              {busy === "document" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <FileUp size={14} aria-hidden />}
              {busy === "document" ? "Uploading…" : "Add"}
            </Button>
          </form>
        </div>
      ) : null}
      {form.files.length ? (
        <ul className="mt-3 grid gap-2">
          {form.files.map((file) => (
            <li key={file.id} className="min-w-0 rounded-md bg-surface px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <UploadTick />
                <span className="min-w-0 shrink truncate font-medium" title={file.name}>{file.name}</span>
                <StatusBadge status={file.status === "AWAITING" ? "READY" : file.status} />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <RemoteFileLink path={`/pdf-files/${file.id}/file`} filename={file.filename} />
                </div>
              </div>
              {file.adminNote ? <p className="mt-1 break-words">Replace this document. {file.adminNote}</p> : null}
              {file.status === "REUPLOAD" || file.status === "READY" ? (
                <div className="mt-2 grid min-w-0 gap-1 overflow-hidden">
                  <input type="file" disabled={run.isPending} aria-label={`Replace ${file.name}`} onChange={(event) => {
                    const next = event.target.files?.[0];
                    event.target.value = "";
                    if (!next || run.isPending) return;
                    const body = new FormData();
                    body.set("file", next);
                    run.mutate({ kind: `replace:${file.id}`, task: () => api(`/pdf-files/${file.id}/replace`, { method: "POST", body }) });
                  }} />
                  <UploadStatus pending={busy === `replace:${file.id}`} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!locked ? (
        <div className="mt-4">
          <Button variant="primary" disabled={run.isPending || !form.filledName} onClick={() => run.mutate({ kind: "submit", task: () => api(`/my/pdf-forms/${form.id}/submit`, { method: "POST" }) })}>{busy === "submit" ? "Sending…" : "Send"}</Button>
        </div>
      ) : <p className="mt-3 text-sm text-muted">Sent. You can upload again only if the organizer asks for a new copy.</p>}
      </CardContent>
    </Card>
  );
}
