"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import Link from "next/link";
import { useRef, useState } from "react";
import { ApiError, api, download } from "@/lib/api";
import { Pager, usePagedRows } from "@/components/pager";
import { Button, ErrorNote, Field, Modal, Notice, PageHeader, StatusBadge, inputClass } from "@/components/ui";

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
  categories?: { category: { id: string; name: string } }[];
  status: string;
  assignments: Assignment[];
};

type FormOption = { id: string; name: string; status: string; versions?: { id: string; versionNumber: number }[] };
type ExhibitionOption = { id: string; name: string };
type ImportResult = { id: string; filename: string; createdCount: number; skippedCount: number; errorCount: number; createdVendorIds: string[] };
type MailSummary = { transferred: number; sent: number; sending: number; failed: number; failedVendors: { id: string; companyName: string; email: string; error: string }[] };

const emptyVendor = { companyName: "", contactName: "", email: "", categoryId: "", phone: "", exhibitionId: "", formVersionId: "" };
const helper = createColumnHelper<Vendor>();

function formLabel(vendor: Vendor) {
  const assignment = vendor.assignments[0];
  if (!assignment) return "None";
  return `${assignment.formVersion.template.name} v${assignment.formVersion.versionNumber}`;
}

function VendorActions({ vendor, onChange, onDelete }: { vendor: Vendor; onChange: (vendor: Vendor) => void; onDelete: (vendor: Vendor) => void }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);

  function toggle() {
    const node = anchorRef.current;
    if (!node || menu) {
      setMenu(null);
      return;
    }
    const rect = node.getBoundingClientRect();
    const width = 176;
    const height = 88;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    const top = rect.bottom + 4 + height > window.innerHeight ? Math.max(8, rect.top - height - 4) : rect.bottom + 4;
    setMenu({ top, left });
  }

  return (
    <span ref={anchorRef} className="inline-flex">
      <Button size="sm" aria-expanded={Boolean(menu)} aria-haspopup="menu" onClick={toggle}>Actions</Button>
      {menu ? (
        <div role="menu" className="fixed z-50 w-44 rounded-md border border-border bg-surface p-1 shadow-panel" style={{ top: menu.top, left: menu.left }}>
          <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary" onClick={() => { setMenu(null); onChange(vendor); }}>Change form</button>
          <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left text-sm text-danger hover:bg-secondary" onClick={() => { setMenu(null); onDelete(vendor); }}>Delete</button>
        </div>
      ) : null}
    </span>
  );
}

export default function VendorsPage() {
  const client = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(emptyVendor);
  const [changing, setChanging] = useState<Vendor | null>(null);
  const [nextFormId, setNextFormId] = useState("");
  const [nextExhibitionId, setNextExhibitionId] = useState("");
  const [removing, setRemoving] = useState<Vendor | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [bulkFormId, setBulkFormId] = useState("");
  const [bulkExhibitionId, setBulkExhibitionId] = useState("");
  const [formSent, setFormSent] = useState(false);
  const query = useQuery({
    queryKey: ["vendors", q, categoryId],
    queryFn: () => api<{ data: Vendor[] }>(`/vendors?limit=100&q=${encodeURIComponent(q)}${categoryId ? `&categoryId=${encodeURIComponent(categoryId)}` : ""}`),
  });
  const categories = useQuery({
    queryKey: ["vendor-categories"],
    queryFn: () => api<{ data: { id: string; name: string }[] }>("/vendor-categories"),
  });
  const pickerOpen = open || Boolean(changing) || Boolean(importResult);
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
    mutationFn: () => {
      const { categoryId, ...rest } = form;
      return api("/vendors", { method: "POST", body: JSON.stringify({ ...rest, categoryIds: categoryId ? [categoryId] : [] }) });
    },
    onSuccess: async () => {
      setOpen(false);
      setForm(emptyVendor);
      setError("");
      setNotice("Vendor created. An invitation email is on the way.");
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not create the vendor."),
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
      setBulkFormId("");
      setBulkExhibitionId("");
      setFormSent(false);
      setImportResult(result.data);
      setError("");
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Import failed."),
  });
  const sendImported = useMutation({
    mutationFn: () => api<{ data: { assigned: number; failed: number; failedVendorIds: string[] } }>("/assignments/bulk", { method: "POST", body: JSON.stringify({ vendorIds: importResult?.createdVendorIds ?? [], exhibitionId: bulkExhibitionId, formVersionId: bulkFormId }) }),
    onSuccess: async (result) => {
      setFormSent(true);
      setNotice(`${result.data.assigned} invitations were queued.${result.data.failed ? ` ${result.data.failed} could not be queued.` : ""}`);
      await client.invalidateQueries({ queryKey: ["bulk-mail"] });
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not send the form."),
  });
  const mailSummary = useQuery({
    queryKey: ["bulk-mail", importResult?.id, formSent],
    queryFn: () => api<{ data: MailSummary }>("/assignments/mail-summary", {
      method: "POST",
      body: JSON.stringify({ vendorIds: importResult?.createdVendorIds ?? [], expectInvitation: formSent }),
    }),
    enabled: Boolean(importResult?.createdVendorIds.length),
    refetchInterval: (query) => (query.state.data?.data.sending ? 2000 : false),
  });
  const resendFailed = useMutation({
    mutationFn: () => api<{ data: { resent: number } }>("/assignments/mail-resend", {
      method: "POST",
      body: JSON.stringify({
        vendorIds: mailSummary.data?.data.failedVendors.map((vendor) => vendor.id) ?? [],
        exhibitionId: bulkExhibitionId || undefined,
        formVersionId: bulkFormId || undefined,
      }),
    }),
    onSuccess: async (result) => {
      setNotice(`Queued ${result.data.resent} failed ${result.data.resent === 1 ? "message" : "messages"} again.`);
      await client.invalidateQueries({ queryKey: ["bulk-mail"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not send the failed messages again."),
  });
  const vendors = usePagedRows(query.data?.data ?? [], `${q}|${categoryId}`);
  const columns = [
    helper.accessor("companyName", {
      header: "Company",
      cell: (info) => {
        const vendor = info.row.original;
        const detail = [vendor.reference, vendor.contactName].filter(Boolean).join(" · ");
        return (
          <div className="min-w-36">
            <Link className="font-medium underline" href={`/admin/vendors/${vendor.id}`}>{vendor.companyName}</Link>
            <p className="max-w-xs truncate text-xs text-muted" title={detail}>{detail}</p>
          </div>
        );
      },
    }),
    helper.accessor("email", { header: "Email", cell: (info) => <span className="block max-w-[220px] truncate" title={info.getValue()}>{info.getValue()}</span> }),
    helper.display({
      id: "category",
      header: "Category",
      cell: (info) => {
        const names = (info.row.original.categories ?? []).map((link) => link.category.name).sort((left, right) => left.localeCompare(right));
        const label = names.length ? names.join(", ") : info.row.original.category;
        return <span className="block max-w-[200px] truncate" title={label}>{label || "None"}</span>;
      },
    }),
    helper.display({ id: "form", header: "Form", cell: (info) => formLabel(info.row.original) }),
    helper.accessor("status", { header: "Status", cell: (info) => <StatusBadge status={info.getValue()} /> }),
    helper.display({
      id: "actions",
      header: "",
      cell: (info) => (
        <VendorActions
          vendor={info.row.original}
          onChange={(vendor) => { setError(""); const assignment = vendor.assignments[0]; setNextFormId(assignment?.formVersion.id ?? ""); setNextExhibitionId(assignment?.exhibitionId ?? ""); setChanging(vendor); }}
          onDelete={(vendor) => { setError(""); setRemoving(vendor); }}
        />
      ),
    }),
  ];
  const table = useReactTable({ data: vendors.rows, columns, getCoreRowModel: getCoreRowModel(), autoResetPageIndex: false });
  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Directory of exhibiting companies. Each vendor can be invited or moved to another form."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void download("/imports/template", "vendor-demo.csv").catch(() => setError("Could not download the demo CSV."))}>Demo CSV</Button>
            <Button disabled={upload.isPending} onClick={() => fileRef.current?.click()}>{upload.isPending ? "Uploading…" : "Bulk upload"}</Button>
            <Button variant="primary" onClick={() => { setError(""); setOpen(true); }}>Add vendor</Button>
            <input ref={fileRef} className="hidden" type="file" accept=".csv,.xlsx" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) upload.mutate(file); }} />
          </div>
        }
      />
      <Notice message={notice} />
      <ErrorNote message={error} />
      <div className="mb-3 mt-3 flex flex-wrap gap-2">
        <input className={`${inputClass} max-w-sm`} placeholder="Search company, email, or reference" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Filter vendors" />
        <select className={`${inputClass} max-w-xs`} aria-label="Category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">All categories</option>
          {(categories.data?.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </div>
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
      <Pager page={vendors.page} pageCount={vendors.pageCount} total={vendors.total} rangeStart={vendors.rangeStart} rangeEnd={vendors.rangeEnd} onPage={vendors.setPage} />
      {query.isLoading ? <p className="mt-3 text-sm text-muted">Loading vendors…</p> : null}
      {!query.isLoading && vendors.total === 0 ? <p className="mt-3 text-sm text-muted">No vendors match this filter.</p> : null}
      <Modal open={open} title="Add vendor" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); setError(""); create.mutate(); }}>
          <ErrorNote message={error} />
          <Field label="Company"><input className={inputClass} required value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></Field>
          <Field label="Contact"><input className={inputClass} required value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></Field>
          <Field label="Email"><input className={inputClass} type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label="Phone"><input className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
          <Field label="Category">
            <select className={inputClass} value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
              <option value="">Select</option>
              {(categories.data?.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </Field>
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
      <Modal open={Boolean(importResult)} title="Upload summary" onClose={() => { setImportResult(null); setFormSent(false); }}>
        {importResult ? (
          <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); setError(""); sendImported.mutate(); }}>
            <ErrorNote message={error} />
            <p className="text-sm font-medium">{importResult.filename}</p>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-md bg-secondary px-3 py-2"><dt className="text-muted">Transferred</dt><dd className="text-lg font-semibold">{importResult.createdCount}</dd></div>
              <div className="rounded-md bg-secondary px-3 py-2"><dt className="text-muted">Skipped</dt><dd className="text-lg font-semibold">{importResult.skippedCount}</dd></div>
              <div className="rounded-md bg-secondary px-3 py-2"><dt className="text-muted">Not transferred</dt><dd className="text-lg font-semibold">{importResult.errorCount}</dd></div>
            </dl>
            {mailSummary.data ? (
              <div className="grid gap-2 rounded-md border border-border p-3 text-sm">
                <p className="font-medium">Mail</p>
                <p>{mailSummary.data.data.sent} sent, {mailSummary.data.data.sending} still sending, {mailSummary.data.data.failed} failed.</p>
                {mailSummary.data.data.failedVendors.slice(0, 8).map((vendor) => (
                  <p key={vendor.id} className="text-muted">{vendor.companyName} · {vendor.email}{vendor.error ? ` — ${vendor.error}` : ""}</p>
                ))}
                {mailSummary.data.data.failedVendors.length > 8 ? <p className="text-muted">And {mailSummary.data.data.failedVendors.length - 8} more.</p> : null}
                {mailSummary.data.data.failed > 0 ? (
                  <Button type="button" variant="primary" disabled={resendFailed.isPending} onClick={() => { setError(""); resendFailed.mutate(); }}>
                    {resendFailed.isPending ? "Sending again…" : "Send again to failed"}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {importResult.createdVendorIds.length > 0 && !formSent ? (
              <>
                <p className="text-sm text-muted">Choose the form to email to everyone transferred in this file. Each vendor receives a one-time link.</p>
                <Field label="Exhibition">
                  <select className={inputClass} required value={bulkExhibitionId} onChange={(event) => setBulkExhibitionId(event.target.value)}>
                    <option value="">Select</option>
                    {(exhibitions.data?.data ?? []).map((exhibition) => <option key={exhibition.id} value={exhibition.id}>{exhibition.name}</option>)}
                  </select>
                </Field>
                <Field label="Form">
                  <select className={inputClass} required value={bulkFormId} onChange={(event) => setBulkFormId(event.target.value)}>
                    <option value="">Select</option>
                    {publishedForms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </Field>
                <Button type="submit" variant="primary" disabled={sendImported.isPending || !bulkFormId || !bulkExhibitionId}>Send form</Button>
              </>
            ) : null}
            {importResult.createdVendorIds.length === 0 ? <p className="text-sm text-muted">No new vendors were transferred, so there is nobody to email.</p> : null}
            {importResult.errorCount > 0 ? <Button type="button" onClick={() => void download(`/imports/${importResult.id}/errors.csv`, "import-errors.csv")}>Download error report</Button> : null}
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
