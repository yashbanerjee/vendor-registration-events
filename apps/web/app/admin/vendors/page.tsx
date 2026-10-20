"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import Link from "next/link";
import { useRef, useState } from "react";
import { ApiError, api, download } from "@/lib/api";
import { Badge, Button, ErrorNote, Field, Modal, PageHeader, inputClass, statusTone } from "@/components/ui";

type Assignment = {
  id: string;
  status: string;
  exhibitionId: string;
  formVersion: { id: string; versionNumber: number; template: { name: string } };
};

type Vendor = {
  id: string;
  reference: string;
  companyName: string;
  contactName: string;
  email: string;
  category: string;
  status: string;
  assignments: Assignment[];
};

type FormOption = { id: string; name: string; status: string; versions?: { id: string; versionNumber: number }[] };
type ExhibitionOption = { id: string; name: string };
type ImportResult = { id: string; filename: string; createdCount: number; skippedCount: number; errorCount: number };

const emptyVendor = { companyName: "", contactName: "", email: "", category: "", phone: "", exhibitionId: "", formVersionId: "" };
const helper = createColumnHelper<Vendor>();

function formLabel(vendor: Vendor) {
  const assignment = vendor.assignments[0];
  if (!assignment) return "None";
  return `${assignment.formVersion.template.name} v${assignment.formVersion.versionNumber}`;
}

function VendorActions({ vendor, resetting, onReset, onChange, onDelete }: { vendor: Vendor; resetting: boolean; onReset: (vendor: Vendor) => void; onChange: (vendor: Vendor) => void; onDelete: (vendor: Vendor) => void }) {
  const [open, setOpen] = useState(false);
  const assignment = vendor.assignments[0];
  return (
    <div className="relative">
      <Button size="sm" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>Actions</Button>
      {open ? (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-border bg-surface p-1 shadow-panel">
          <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary disabled:opacity-50" disabled={!assignment || resetting} onClick={() => { setOpen(false); onReset(vendor); }}>Reset mail</button>
          <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary" onClick={() => { setOpen(false); onChange(vendor); }}>Change form</button>
          <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left text-sm text-danger hover:bg-secondary" onClick={() => { setOpen(false); onDelete(vendor); }}>Delete</button>
        </div>
      ) : null}
    </div>
  );
}

export default function VendorsPage() {
  const client = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(emptyVendor);
  const [changing, setChanging] = useState<Vendor | null>(null);
  const [nextFormId, setNextFormId] = useState("");
  const [nextExhibitionId, setNextExhibitionId] = useState("");
  const [removing, setRemoving] = useState<Vendor | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const query = useQuery({
    queryKey: ["vendors", q],
    queryFn: () => api<{ data: Vendor[] }>(`/vendors?q=${encodeURIComponent(q)}`),
  });
  const pickerOpen = open || Boolean(changing);
  const exhibitions = useQuery({
    queryKey: ["exhibitions"],
    queryFn: () => api<{ data: ExhibitionOption[] }>("/exhibitions"),
    enabled: pickerOpen,
  });
  const forms = useQuery({
    queryKey: ["forms"],
    queryFn: () => api<{ data: FormOption[] }>("/forms"),
    enabled: pickerOpen,
  });
  const publishedForms = (forms.data?.data ?? []).flatMap((item) =>
    item.status === "PUBLISHED" ? (item.versions ?? []).map((version) => ({ id: version.id, label: `${item.name} v${version.versionNumber}` })) : [],
  );
  const refresh = () => client.invalidateQueries({ queryKey: ["vendors"] });
  const create = useMutation({
    mutationFn: () => api("/vendors", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: async () => {
      setOpen(false);
      setForm(emptyVendor);
      setError("");
      setNotice("Vendor created. An invitation email is on the way.");
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not create the vendor."),
  });
  const resetMail = useMutation({
    mutationFn: (assignmentId: string) => api(`/assignments/${assignmentId}/resend`, { method: "POST" }),
    onSuccess: () => setNotice("The invitation email was sent again."),
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not resend the email."),
  });
  const changeForm = useMutation({
    mutationFn: () => {
      const assignment = changing?.assignments[0];
      if (!changing) throw new Error("Choose a vendor.");
      if (assignment) return api(`/assignments/${assignment.id}/form`, { method: "POST", body: JSON.stringify({ formVersionId: nextFormId }) });
      return api("/assignments", { method: "POST", body: JSON.stringify({ vendorId: changing.id, exhibitionId: nextExhibitionId, formVersionId: nextFormId }) });
    },
    onSuccess: async () => {
      setChanging(null);
      setNotice("The form was changed and a new invitation email was sent.");
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not change the form."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api("/vendors/archive", { method: "POST", body: JSON.stringify({ ids: [id] }) }),
    onSuccess: async () => {
      setRemoving(null);
      setNotice("Vendor deleted.");
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not delete the vendor."),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.set("file", file);
      return api<{ data: ImportResult }>("/imports", { method: "POST", body });
    },
    onSuccess: async (result) => {
      setImportResult(result.data);
      setError("");
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Import failed."),
  });
  const columns = [
    helper.accessor("companyName", {
      header: "Company",
      cell: (info) => {
        const vendor = info.row.original;
        const detail = [vendor.reference, vendor.contactName, vendor.category].filter(Boolean).join(" · ");
        return (
          <div className="min-w-36">
            <Link className="font-medium underline" href={`/admin/vendors/${vendor.id}`}>{vendor.companyName}</Link>
            <p className="max-w-xs truncate text-xs text-muted" title={detail}>{detail}</p>
          </div>
        );
      },
    }),
    helper.accessor("email", { header: "Email", cell: (info) => <span className="block max-w-[220px] truncate" title={info.getValue()}>{info.getValue()}</span> }),
    helper.display({ id: "form", header: "Form", cell: (info) => formLabel(info.row.original) }),
    helper.accessor("status", { header: "Status", cell: (info) => <Badge tone={statusTone(info.getValue())}>{info.getValue()}</Badge> }),
    helper.display({
      id: "actions",
      header: "",
      cell: (info) => (
        <VendorActions
          vendor={info.row.original}
          resetting={resetMail.isPending}
          onReset={(vendor) => { setError(""); const assignment = vendor.assignments[0]; if (assignment) resetMail.mutate(assignment.id); }}
          onChange={(vendor) => { setError(""); const assignment = vendor.assignments[0]; setNextFormId(assignment?.formVersion.id ?? ""); setNextExhibitionId(assignment?.exhibitionId ?? ""); setChanging(vendor); }}
          onDelete={(vendor) => { setError(""); setRemoving(vendor); }}
        />
      ),
    }),
  ];
  const table = useReactTable({ data: query.data?.data ?? [], columns, getCoreRowModel: getCoreRowModel() });
  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Directory of exhibiting companies. Each vendor can be invited, re-sent their link, or moved to another form."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void download("/imports/template", "vendor-import-template.csv").catch(() => setError("Could not download the template."))}>Template</Button>
            <Button disabled={upload.isPending} onClick={() => fileRef.current?.click()}>{upload.isPending ? "Uploading…" : "Bulk upload"}</Button>
            <Button variant="primary" onClick={() => { setError(""); setOpen(true); }}>Add vendor</Button>
            <input ref={fileRef} className="hidden" type="file" accept=".csv,.xlsx" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) upload.mutate(file); }} />
          </div>
        }
      />
      {notice ? <p className="mb-3 rounded-md bg-[var(--badge-success-bg)] px-3 py-2 text-sm text-[var(--badge-success-fg)]">{notice}</p> : null}
      <ErrorNote message={error} />
      <input className={`${inputClass} mb-3 mt-3 max-w-sm`} placeholder="Search company, email, or reference" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Filter vendors" />
      <div className="table-wrap">
        <table className="data">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.isLoading ? <p className="mt-3 text-sm text-muted">Loading vendors…</p> : null}
      {!query.isLoading && (query.data?.data.length ?? 0) === 0 ? <p className="mt-3 text-sm text-muted">No vendors match this filter.</p> : null}
      <Modal open={open} title="Add vendor" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); setError(""); create.mutate(); }}>
          <ErrorNote message={error} />
          <Field label="Company"><input className={inputClass} required value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></Field>
          <Field label="Contact"><input className={inputClass} required value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></Field>
          <Field label="Email"><input className={inputClass} type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label="Phone"><input className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
          <Field label="Category"><input className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></Field>
          <Field label="Exhibition">
            <select className={inputClass} required value={form.exhibitionId} onChange={(event) => setForm({ ...form, exhibitionId: event.target.value })}>
              <option value="">Select</option>
              {(exhibitions.data?.data ?? []).map((exhibition) => <option key={exhibition.id} value={exhibition.id}>{exhibition.name}</option>)}
            </select>
          </Field>
          <Field label="Form" hint="The vendor is emailed a one-time link to complete this form.">
            <select className={inputClass} required value={form.formVersionId} onChange={(event) => setForm({ ...form, formVersionId: event.target.value })}>
              <option value="">Select</option>
              {publishedForms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          {open && !forms.isLoading && publishedForms.length === 0 ? <p className="text-sm text-muted">Publish a form before inviting a vendor.</p> : null}
          <Button type="submit" variant="primary" disabled={create.isPending || publishedForms.length === 0}>Create vendor</Button>
        </form>
      </Modal>
      <Modal open={Boolean(changing)} title={changing ? `Change form for ${changing.companyName}` : "Change form"} onClose={() => setChanging(null)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); setError(""); changeForm.mutate(); }}>
          <ErrorNote message={error} />
          {changing && !changing.assignments[0] ? (
            <Field label="Exhibition">
              <select className={inputClass} required value={nextExhibitionId} onChange={(event) => setNextExhibitionId(event.target.value)}>
                <option value="">Select</option>
                {(exhibitions.data?.data ?? []).map((exhibition) => <option key={exhibition.id} value={exhibition.id}>{exhibition.name}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label="Form" hint="A new invitation email is sent with a link to this form.">
            <select className={inputClass} required value={nextFormId} onChange={(event) => setNextFormId(event.target.value)}>
              <option value="">Select</option>
              {publishedForms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          <Button type="submit" variant="primary" disabled={changeForm.isPending || !nextFormId}>Save form</Button>
        </form>
      </Modal>
      <Modal open={Boolean(removing)} title="Delete vendor" onClose={() => setRemoving(null)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); if (removing) remove.mutate(removing.id); }}>
          <ErrorNote message={error} />
          <p className="text-sm">Delete {removing?.companyName}? Open invitation links stop working, and the company leaves the directory.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={remove.isPending}>Delete</Button>
          </div>
        </form>
      </Modal>
      <Modal open={Boolean(importResult)} title="Bulk upload finished" onClose={() => setImportResult(null)}>
        {importResult ? (
          <div className="grid gap-3 text-sm">
            <p>{importResult.filename}: {importResult.createdCount} created, {importResult.skippedCount} skipped, {importResult.errorCount} errors.</p>
            <p className="text-muted">New contacts receive a portal login email with a temporary password.</p>
            {importResult.errorCount > 0 ? <Button onClick={() => void download(`/imports/${importResult.id}/errors.csv`, "import-errors.csv")}>Download error report</Button> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
