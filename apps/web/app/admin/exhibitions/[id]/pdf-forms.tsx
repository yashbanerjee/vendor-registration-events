"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Send } from "lucide-react";
import { useRef, useState } from "react";
import { ApiError, api, download } from "@/lib/api";
import { useSession } from "@/components/providers";
import { Button, ErrorNote, Field, StatusBadge, inputClass } from "@/components/ui";

type PacketFile = { id: string; name: string; filename: string; status: string; adminNote: string };
type PacketForm = {
  formId: string;
  formName: string;
  returnId: string | null;
  status: string;
  filename: string;
  adminNote: string;
  files: PacketFile[];
};
type PacketVendor = { id: string; companyName: string; email: string; reference: string; forms: PacketForm[] };
type Packets = { data: { forms: { id: string; name: string; filename: string }[]; vendors: PacketVendor[] } };
type VendorOption = { id: string; companyName: string; email: string };

export function PdfForms({ exhibitionId }: { exhibitionId: string }) {
  const { session } = useSession();
  const canWrite = session?.permissions.includes("exhibitions.write") ?? false;
  const client = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const query = useQuery({ queryKey: ["pdf-forms", exhibitionId], queryFn: () => api<Packets>(`/exhibitions/${exhibitionId}/pdf-forms`) });
  const upload = useMutation({
    mutationFn: () => {
      const body = new FormData();
      body.set("name", name);
      if (file) body.set("file", file);
      return api(`/exhibitions/${exhibitionId}/pdf-forms`, { method: "POST", body });
    },
    onSuccess: async () => {
      setName("");
      setFile(null);
      setError("");
      if (fileRef.current) fileRef.current.value = "";
      await client.invalidateQueries({ queryKey: ["pdf-forms", exhibitionId] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not upload the form."),
  });
  const forms = query.data?.data.forms ?? [];
  const vendors = query.data?.data.vendors ?? [];
  const submitted = vendors.reduce((sum, vendor) => sum + vendor.forms.filter((form) => form.status === "SUBMITTED" || form.status === "REUPLOAD").length, 0);

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
            <h2 className="text-lg font-semibold tracking-tight">PDF files for this event</h2>
            <p className="mt-1 text-sm text-muted">Upload the blank PDF. Companies download it, fill it in, and send it back.</p>
            <ErrorNote message={error || (query.isError ? "Could not load PDF forms." : "")} />
            {canWrite ? <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); setError(""); upload.mutate(); }}>
              <Field label="Form name"><input className={inputClass} required value={name} onChange={(event) => setName(event.target.value)} placeholder="Booth application" /></Field>
              <Field label="PDF file">
                <input ref={fileRef} className="block w-full rounded-md border border-dashed border-border bg-secondary px-3 py-3 text-sm" type="file" accept="application/pdf,.pdf" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </Field>
              <div>
                <Button type="submit" variant="primary" disabled={upload.isPending}>{upload.isPending ? "Uploading…" : "Add PDF form"}</Button>
              </div>
            </form> : <p className="mt-4 text-sm text-muted">You can review returned files. Adding forms is limited to organizers.</p>}
          </div>
          <div className="p-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Files on this event</p>
                <p className="text-2xl font-semibold tracking-tight">{forms.length}</p>
              </div>
              <p className="text-sm text-muted">{submitted} returned</p>
            </div>
            {forms.length ? (
              <ul className="grid gap-2">
                {forms.map((form) => (
                  <li key={form.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--badge-info-bg)] text-brand"><FileText size={16} aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{form.name}</span>
                      <span className="block truncate text-xs text-muted">{form.filename}</span>
                    </span>
                    <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-brand" onClick={() => void download(`/pdf-forms/${form.id}/file`, form.filename)}>
                      <Download size={14} aria-hidden />
                      Blank
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">{query.isLoading ? "Loading forms…" : "No PDF forms yet."}</p>}
          </div>
        </div>
      </section>

      {canWrite ? <AssignVendors exhibitionId={exhibitionId} assignedIds={vendors.map((vendor) => vendor.id)} onAssigned={setNotice} /> : null}
      {notice ? <p className="text-sm text-muted">{notice}</p> : null}

      <section className="grid gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Review</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Returned files</h2>
          <p className="text-sm text-muted">Open a filled PDF or a named document, then send that item back with a note.</p>
        </div>
        {vendors.length === 0 ? <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted">Assign vendors to this exhibition to collect their PDFs.</p> : null}
        {vendors.map((vendor) => (
          <article key={vendor.id} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <h3 className="font-semibold">{vendor.companyName}</h3>
                <p className="text-xs text-muted">{vendor.email}</p>
              </div>
              <p className="text-xs text-muted">{vendor.reference}</p>
            </div>
            <div className="grid gap-3 p-4">
              {vendor.forms.length === 0 ? <p className="text-sm text-muted">No PDF forms have been added yet.</p> : null}
              {vendor.forms.map((form) => (
                <ReturnedForm key={form.formId} exhibitionId={exhibitionId} form={form} />
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function AssignVendors({ exhibitionId, assignedIds, onAssigned }: { exhibitionId: string; assignedIds: string[]; onAssigned: (message: string) => void }) {
  const client = useQueryClient();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState("");
  const vendors = useQuery({
    queryKey: ["vendor-options", q],
    queryFn: () => api<{ data: VendorOption[] }>(`/vendors?limit=100${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`),
  });
  const assign = useMutation({
    mutationFn: () => api<{ data: { assigned: number } }>(`/exhibitions/${exhibitionId}/pdf-forms/assign`, { method: "POST", body: JSON.stringify({ vendorIds: picked }) }),
    onSuccess: async (result) => {
      setPicked([]);
      setError("");
      onAssigned(result.data.assigned ? `Emailed ${result.data.assigned} vendor${result.data.assigned === 1 ? "" : "s"}.` : "Those vendors were already on this exhibition.");
      await client.invalidateQueries({ queryKey: ["pdf-forms", exhibitionId] });
      await client.invalidateQueries({ queryKey: ["exhibition", exhibitionId] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not assign those vendors."),
  });
  const rows = vendors.data?.data ?? [];
  const assigned = new Set(assignedIds);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Send these PDFs</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">Pick the companies that should receive these files. This does not send the online questions.</p>
        </div>
        <Button variant="primary" disabled={!picked.length || assign.isPending} onClick={() => { setError(""); assign.mutate(); }}>
          <Send size={14} aria-hidden />
          {assign.isPending ? "Sending…" : `Email ${picked.length || ""}`.trim()}
        </Button>
      </div>
      <ErrorNote message={error} />
      <input className={`${inputClass} mt-3 max-w-sm`} placeholder="Search vendors" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Search vendors to assign" />
      <ul className="mt-3 grid max-h-64 gap-1 overflow-auto">
        {rows.map((vendor) => {
          const already = assigned.has(vendor.id);
          const checked = already || picked.includes(vendor.id);
          return (
            <li key={vendor.id}>
              <label className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm ${already ? "text-muted" : "hover:bg-secondary"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={already}
                  onChange={(event) => setPicked((current) => event.target.checked ? [...current, vendor.id] : current.filter((id) => id !== vendor.id))}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{vendor.companyName}</span>
                  <span className="block truncate text-xs text-muted">{vendor.email}</span>
                </span>
                {already ? <span className="text-xs">Already assigned</span> : null}
              </label>
            </li>
          );
        })}
      </ul>
      {!vendors.isLoading && rows.length === 0 ? <p className="mt-2 text-sm text-muted">No vendors match that search.</p> : null}
    </section>
  );
}

function ReturnedForm({ exhibitionId, form }: { exhibitionId: string; form: PacketForm }) {
  return (
    <div className="rounded-md border border-border bg-secondary px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">{form.formName}</p>
        <StatusBadge status={form.status} />
        {form.returnId && form.filename ? (
          <button type="button" className="text-sm font-semibold text-brand" onClick={() => void download(`/pdf-returns/${form.returnId}/file`, form.filename)}>Open filled PDF</button>
        ) : <span className="text-xs text-muted">Waiting for the filled PDF</span>}
      </div>
      {form.adminNote ? <p className="mt-2 rounded-md bg-[var(--badge-warning-bg)] px-3 py-2 text-sm">{form.adminNote}</p> : null}
      {form.returnId && form.status !== "AWAITING" ? <Reupload exhibitionId={exhibitionId} path={`/pdf-returns/${form.returnId}/reupload`} label="Send form back" /> : null}
      {form.files.length ? (
        <ul className="mt-3 grid gap-2">
          {form.files.map((file) => (
            <li key={file.id} className="rounded-md border border-border bg-surface px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{file.name}</span>
                <StatusBadge status={file.status} />
                <button type="button" className="text-sm font-semibold text-brand" onClick={() => void download(`/pdf-files/${file.id}/file`, file.filename)}>{file.filename}</button>
              </div>
              {file.adminNote ? <p className="mt-1 text-sm">{file.adminNote}</p> : null}
              {form.status !== "AWAITING" ? <Reupload exhibitionId={exhibitionId} path={`/pdf-files/${file.id}/reupload`} label="Send document back" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Reupload({ exhibitionId, path, label }: { exhibitionId: string; path: string; label: string }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const send = useMutation({
    mutationFn: () => api(path, { method: "POST", body: JSON.stringify({ note }) }),
    onSuccess: async () => {
      setOpen(false);
      setNote("");
      await client.invalidateQueries({ queryKey: ["pdf-forms", exhibitionId] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not send the request."),
  });
  if (!open) return <button type="button" className="mt-2 text-xs font-semibold text-brand" onClick={() => setOpen(true)}>{label}</button>;
  return (
    <form className="mt-2 grid gap-2" onSubmit={(event) => { event.preventDefault(); setError(""); send.mutate(); }}>
      <ErrorNote message={error} />
      <textarea className="min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm leading-5" required placeholder="Tell the vendor what to replace" value={note} onChange={(event) => setNote(event.target.value)} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={send.isPending}>Send for re-upload</Button>
        <Button type="button" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
