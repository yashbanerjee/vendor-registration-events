"use client";

import { useMutation } from "@tanstack/react-query";
import { Download, FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { ApiError, api, download } from "@/lib/api";
import { Button, ErrorNote, Field, StatusBadge, inputClass } from "@/components/ui";

type PacketFile = { id: string; name: string; filename: string; status: string; adminNote: string };
export type Packet = {
  id: string;
  name: string;
  filename: string;
  exhibition: { id: string; name: string; venue: string };
  status: string;
  filledName: string;
  adminNote: string;
  files: PacketFile[];
};

export function PacketCard({ form, onChange }: { form: Packet; onChange: () => Promise<void> }) {
  const locked = form.status === "SUBMITTED";
  const docRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [docName, setDocName] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const run = useMutation({
    mutationFn: async (task: () => Promise<unknown>) => task(),
    onSuccess: async () => {
      setError("");
      setDocName("");
      setDocFile(null);
      if (docRef.current) docRef.current.value = "";
      await onChange();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not save that file."),
  });
  const step = locked ? 4 : form.files.length ? 3 : form.filledName ? 2 : 0;

  function uploadFilled(file: File | null) {
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    run.mutate(() => api(`/my/pdf-forms/${form.id}/filled`, { method: "POST", body }));
  }

  function uploadDocument(event: React.FormEvent) {
    event.preventDefault();
    if (!docFile) return;
    const body = new FormData();
    body.set("name", docName);
    body.set("file", docFile);
    run.mutate(() => api(`/my/pdf-forms/${form.id}/documents`, { method: "POST", body }));
  }

  return (
    <div className="rounded-xl border border-border bg-secondary p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{form.name}</h3>
            <StatusBadge status={form.status} />
          </div>
          {form.exhibition.name ? <p className="mt-1 text-sm text-muted">{form.exhibition.name}</p> : null}
          <ol className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
            {["Download", "Upload PDF", "Add documents", "Submit"].map((label, index) => (
              <li key={label} className={`rounded-full px-2.5 py-1 ${index < step ? "bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]" : "bg-surface text-muted ring-1 ring-border"}`}>{index + 1} {label}</li>
            ))}
          </ol>
        </div>
        <Button size="sm" onClick={() => void download(`/pdf-forms/${form.id}/file`, form.filename)}>
          <Download size={14} aria-hidden />
          Download blank PDF
        </Button>
      </div>
      {form.filledName ? <p className="mt-3 text-sm text-muted">Filled copy: {form.filledName}</p> : null}
      {form.adminNote ? <p className="mt-3 rounded-md bg-[var(--badge-warning-bg)] px-3 py-2 text-sm">Replace this form. {form.adminNote}</p> : null}
      <ErrorNote message={error} />
      {!locked ? (
        <div className="mt-4 grid gap-4">
          <Field label="Upload the filled PDF">
            <input className="block w-full rounded-md border border-dashed border-border bg-secondary px-3 py-3 text-sm" type="file" accept="application/pdf,.pdf" onChange={(event) => uploadFilled(event.target.files?.[0] ?? null)} />
          </Field>
          <form className="grid gap-2 rounded-md bg-secondary p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={uploadDocument}>
            <Field label="Document name"><input className={inputClass} value={docName} onChange={(event) => setDocName(event.target.value)} placeholder="Trade license" /></Field>
            <Field label="File">
              <input ref={docRef} className="block w-full text-sm" type="file" onChange={(event) => setDocFile(event.target.files?.[0] ?? null)} />
            </Field>
            <Button type="submit" size="sm" disabled={run.isPending || !docName.trim() || !docFile}>
              <FileUp size={14} aria-hidden />
              Add
            </Button>
          </form>
        </div>
      ) : null}
      {form.files.length ? (
        <ul className="mt-3 grid gap-2">
          {form.files.map((file) => (
            <li key={file.id} className="rounded-md bg-secondary px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{file.name}</span>
                <StatusBadge status={file.status} />
                <button type="button" className="font-semibold text-brand" onClick={() => void download(`/pdf-files/${file.id}/file`, file.filename)}>{file.filename}</button>
              </div>
              {file.adminNote ? <p className="mt-1">Replace this document. {file.adminNote}</p> : null}
              {file.status === "REUPLOAD" ? (
                <input className="mt-2 block w-full text-sm" type="file" aria-label={`Replace ${file.name}`} onChange={(event) => {
                  const next = event.target.files?.[0];
                  if (!next) return;
                  const body = new FormData();
                  body.set("file", next);
                  run.mutate(() => api(`/pdf-files/${file.id}/replace`, { method: "POST", body }));
                }} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!locked ? (
        <div className="mt-4">
          <Button variant="primary" disabled={run.isPending || !form.filledName} onClick={() => run.mutate(() => api(`/my/pdf-forms/${form.id}/submit`, { method: "POST" }))}>Submit PDF form</Button>
        </div>
      ) : <p className="mt-3 text-sm text-muted">Submitted. A new upload opens only if this form or a document is sent back.</p>}
    </div>
  );
}
