"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import Link from "next/link";
import { useRef, useState } from "react";
import { ApiError, api, download } from "@/lib/api";
import { Pager, usePagedRows } from "@/components/pager";
import { Button, ErrorNote, Field, FilterBar, LoadingState, Modal, ModalActions, Notice, PageHeader, Spinner, StatusBadge, inputClass } from "@/components/ui";

function fieldError(caught: unknown, fallback: string) {
  if (!(caught instanceof ApiError)) return fallback;
  if (Array.isArray(caught.details)) {
    const issue = caught.details.find((item) => item && typeof item === "object" && "message" in item) as { message?: unknown } | undefined;
    if (typeof issue?.message === "string" && issue.message) return issue.message;
  }
  return caught.message || fallback;
}

type Assignment = {
  id: string;
  status: string;
  exhibitionId: string;
  invitationSentAt: string | null;
  formVersion: { id: string; versionNumber: number; template: { name: string } };
};

type Vendor = {
  id: string;
  reference: string;
  companyName: string;
  contactName: string;
  email: string;
  status: string;
  assignments: Assignment[];
};

type FormOption = { id: string; name: string; status: string; versions?: { id: string; versionNumber: number }[] };
type ExhibitionOption = { id: string; name: string };
type ImportResult = { id: string; filename: string; createdCount: number; skippedCount: number; errorCount: number; createdVendorIds: string[]; rows?: { rowNumber: number; status: string; messages: string[] }[] };
const emptyVendor = { companyName: "", contactName: "", email: "", phone: "", exhibitionId: "", formVersionId: "" };
const helper = createColumnHelper<Vendor>();

function formLabel(vendor: Vendor) {
  const assignment = vendor.assignments[0];
  if (!assignment) return "None";
  return `${assignment.formVersion.template.name} v${assignment.formVersion.versionNumber}`;
}

const CLOSED_ASSIGNMENT = new Set(["APPROVED", "REVOKED", "REJECTED"]);

function canRemind(assignment: Assignment | undefined) {
  return Boolean(assignment && !CLOSED_ASSIGNMENT.has(assignment.status));
}

function VendorActions({
  vendor,
  sending,
  reminding,
  onSendMail,
  onRemind,
  onChange,
  onDelete,
}: {
  vendor: Vendor;
  sending: boolean;
  reminding: boolean;
  onSendMail: (vendor: Vendor) => void;
  onRemind: (vendor: Vendor) => void;
  onChange: (vendor: Vendor) => void;
  onDelete: (vendor: Vendor) => void;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const assignment = vendor.assignments[0];
  const canSend = Boolean(assignment) && !assignment.invitationSentAt;
  const remindReady = canRemind(assignment);

  function toggle() {
    const node = anchorRef.current;
    if (!node || menu) {
      setMenu(null);
      return;
    }
    const rect = node.getBoundingClientRect();
    const width = 200;
    const height = 132;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    const top = rect.bottom + 4 + height > window.innerHeight ? Math.max(8, rect.top - height - 4) : rect.bottom + 4;
    setMenu({ top, left });
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {assignment ? (
        <Button
          size="sm"
          variant={canSend ? "primary" : "secondary"}
          disabled={!canSend || sending || reminding}
          onClick={() => onSendMail(vendor)}
        >
          {sending ? "Sending…" : assignment.invitationSentAt ? "Mail sent" : "Send mail"}
        </Button>
      ) : null}
      <span ref={anchorRef} className="inline-flex">
        <Button size="sm" aria-expanded={Boolean(menu)} aria-haspopup="menu" onClick={toggle}>Actions</Button>
        {menu ? (
          <div role="menu" className="fixed z-50 w-52 rounded-md border border-border bg-surface p-1 shadow-panel" style={{ top: menu.top, left: menu.left }}>
            <button
              type="button"
              role="menuitem"
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary disabled:opacity-50"
              disabled={!remindReady || reminding}
              onClick={() => { setMenu(null); onRemind(vendor); }}
            >
              {reminding ? "Sending reminder…" : "Send deadline reminder"}
            </button>
            <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary" onClick={() => { setMenu(null); onChange(vendor); }}>Change form</button>
            <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left text-sm text-danger hover:bg-secondary" onClick={() => { setMenu(null); onDelete(vendor); }}>Delete</button>
          </div>
        ) : null}
      </span>
    </span>
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
  const [bulkFormId, setBulkFormId] = useState("");
  const [bulkExhibitionId, setBulkExhibitionId] = useState("");
  const [formAssigned, setFormAssigned] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmRemind, setConfirmRemind] = useState(false);
  const query = useQuery({
    queryKey: ["vendors", q],
    queryFn: () => api<{ data: Vendor[] }>(`/vendors?limit=100&q=${encodeURIComponent(q)}`),
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
    mutationFn: () => api("/vendors", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: async () => {
      setOpen(false);
      setForm(emptyVendor);
      setError("");
      setNotice("Vendor created. Sponsor account credentials were emailed. Use Send mail for the form invitation.");
      await refresh();
    },
    onError: (caught) => setError(fieldError(caught, "Could not create the vendor.")),
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
      setNotice("The form was saved. Use Send mail in the list to email the invitation once.");
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not change the form."),
  });
  const sendMail = useMutation({
    mutationFn: (assignmentId: string) => api(`/assignments/${assignmentId}/send-invite`, { method: "POST" }),
    onMutate: (assignmentId) => setSendingId(assignmentId),
    onSuccess: async () => {
      setNotice("Invitation email queued. This vendor can only be emailed once for this form.");
      setError("");
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not send the invitation email."),
    onSettled: () => setSendingId(null),
  });
  const sendReminders = useMutation({
    mutationFn: (assignmentIds: string[]) =>
      api<{ data: { sent: number; skipped: { assignmentId: string; reason: string }[]; requested: number } }>(
        "/assignments/reminders",
        { method: "POST", body: JSON.stringify({ assignmentIds }) },
      ),
    onMutate: (assignmentIds) => {
      if (assignmentIds.length === 1) setRemindingId(assignmentIds[0]!);
    },
    onSuccess: async (result) => {
      const { sent, skipped } = result.data;
      setConfirmRemind(false);
      setSelectedIds(new Set());
      setError("");
      setNotice(
        skipped.length
          ? `Queued ${sent} deadline reminder${sent === 1 ? "" : "s"}. ${skipped.length} skipped.`
          : `Queued ${sent} deadline reminder${sent === 1 ? "" : "s"}.`,
      );
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not send deadline reminders."),
    onSettled: () => setRemindingId(null),
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
      setFormAssigned(false);
      setImportResult(result.data);
      setError("");
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Import failed."),
  });
  const assignImported = useMutation({
    mutationFn: () => api<{ data: { assigned: number; failed: number; failedVendorIds: string[] } }>("/assignments/bulk", { method: "POST", body: JSON.stringify({ vendorIds: importResult?.createdVendorIds ?? [], exhibitionId: bulkExhibitionId, formVersionId: bulkFormId }) }),
    onSuccess: async (result) => {
      setFormAssigned(true);
      setNotice(`${result.data.assigned} vendors were assigned the form. Use Send mail in the list to email each invitation once.${result.data.failed ? ` ${result.data.failed} could not be assigned.` : ""}`);
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not assign the form."),
  });
  const vendors = usePagedRows(query.data?.data ?? [], q);
  const allVendors = query.data?.data ?? [];
  const remindableOnPage = vendors.rows.filter((vendor) => canRemind(vendor.assignments[0]));
  const selectedRemindable = allVendors.filter((vendor) => selectedIds.has(vendor.id) && canRemind(vendor.assignments[0]));
  const pageSelectedRemindable = remindableOnPage.filter((vendor) => selectedIds.has(vendor.id));
  const allRemindableSelected = remindableOnPage.length > 0 && pageSelectedRemindable.length === remindableOnPage.length;

  function toggleVendor(vendorId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(vendorId);
      else next.delete(vendorId);
      return next;
    });
  }

  function toggleAllRemindable(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const vendor of remindableOnPage) {
        if (checked) next.add(vendor.id);
        else next.delete(vendor.id);
      }
      return next;
    });
  }

  function reminderAssignmentIds(vendorList: Vendor[]) {
    return vendorList
      .map((vendor) => vendor.assignments[0])
      .filter((assignment): assignment is Assignment => canRemind(assignment))
      .map((assignment) => assignment.id);
  }

  const columns = [
    helper.display({
      id: "select",
      header: () => (
        <input
          type="checkbox"
          className="size-4 accent-[var(--primary)]"
          checked={allRemindableSelected}
          disabled={remindableOnPage.length === 0 || sendReminders.isPending}
          aria-label="Select all vendors that can receive a deadline reminder"
          onChange={(event) => toggleAllRemindable(event.target.checked)}
        />
      ),
      cell: (info) => {
        const vendor = info.row.original;
        const ready = canRemind(vendor.assignments[0]);
        return (
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={selectedIds.has(vendor.id)}
            disabled={!ready || sendReminders.isPending}
            aria-label={`Select ${vendor.companyName}`}
            onChange={(event) => toggleVendor(vendor.id, event.target.checked)}
          />
        );
      },
    }),
    helper.accessor("companyName", {
      header: "Vendor",
      cell: (info) => {
        const vendor = info.row.original;
        const detail = [vendor.reference, vendor.contactName].filter(Boolean).join(" · ");
        return (
          <div className="min-w-0 sm:min-w-36">
            <Link className="font-medium underline" href={`/admin/vendors/${vendor.id}`}>{vendor.companyName}</Link>
            <p className="truncate text-xs font-normal text-muted sm:max-w-xs" title={detail}>{detail}</p>
          </div>
        );
      },
    }),
    helper.accessor("email", { header: "Email", cell: (info) => <span className="block truncate sm:max-w-[220px]" title={info.getValue()}>{info.getValue()}</span> }),
    helper.display({ id: "form", header: "Form", cell: (info) => formLabel(info.row.original) }),
    helper.accessor("status", { header: "Status", cell: (info) => <StatusBadge status={info.getValue()} /> }),
    helper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const vendor = info.row.original;
        const assignment = vendor.assignments[0];
        return (
          <VendorActions
            vendor={vendor}
            sending={Boolean(assignment && sendingId === assignment.id)}
            reminding={Boolean(assignment && remindingId === assignment.id)}
            onSendMail={(row) => {
              const target = row.assignments[0];
              if (!target || target.invitationSentAt) return;
              setError("");
              sendMail.mutate(target.id);
            }}
            onRemind={(row) => {
              const target = row.assignments[0];
              if (!canRemind(target)) return;
              setError("");
              setSelectedIds(new Set([row.id]));
              setConfirmRemind(true);
            }}
            onChange={(row) => { setError(""); const current = row.assignments[0]; setNextFormId(current?.formVersion.id ?? ""); setNextExhibitionId(current?.exhibitionId ?? ""); setChanging(row); }}
            onDelete={(row) => { setError(""); setRemoving(row); }}
          />
        );
      },
    }),
  ];
  const table = useReactTable({ data: vendors.rows, columns, getCoreRowModel: getCoreRowModel(), autoResetPageIndex: false });
  const selectedCount = selectedRemindable.length;
  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Add or import vendors, assign a form, then press Send mail once per vendor. Select one or more vendors to send deadline reminder emails."
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Button onClick={() => void download("/imports/template", "vendor-demo.csv").catch(() => setError("Could not download the demo CSV."))}>Demo CSV</Button>
            <Button disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
              {upload.isPending ? <Spinner size="sm" /> : null}
              {upload.isPending ? "Uploading…" : "Bulk upload"}
            </Button>
            <Button asChild>
              <Link href="/admin/exports">Export</Link>
            </Button>
            {upload.isSuccess && !upload.isPending ? <span className="col-span-2 inline-flex items-center gap-1 self-center text-sm text-[var(--success)]"><Check size={16} aria-hidden /> Uploaded</span> : null}
            <Button className="col-span-2" variant="primary" onClick={() => { setError(""); setOpen(true); }}>Add vendor</Button>
            <input ref={fileRef} className="hidden" type="file" accept=".csv,.xlsx" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) upload.mutate(file); }} />
          </div>
        }
      />
      <Notice message={notice} />
      <ErrorNote className="mb-3" message={error} />
      <FilterBar>
        <input className={`${inputClass} col-span-2 sm:max-w-sm`} placeholder="Search vendor, email, or reference" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Filter vendors" />
        <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:justify-end">
          <Button
            variant="primary"
            disabled={selectedCount === 0 || sendReminders.isPending}
            onClick={() => { setError(""); setConfirmRemind(true); }}
          >
            {sendReminders.isPending ? "Sending…" : `Send deadline reminder${selectedCount ? ` (${selectedCount})` : ""}`}
          </Button>
          {selectedCount > 0 ? (
            <Button type="button" variant="secondary" disabled={sendReminders.isPending} onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </Button>
          ) : null}
        </div>
      </FilterBar>
      <div className="table-wrap">
        <table className="data">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  // The company cell is the card title on a phone, and the actions cell spans the card.
                  const header = cell.column.columnDef.header;
                  const label = cell.column.id === "select"
                    ? "Select"
                    : cell.column.id !== "companyName" && typeof header === "string" && header
                      ? header
                      : undefined;
                  return <td key={cell.id} data-label={label} className={cell.column.id === "actions" ? "text-right" : undefined}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={vendors.page} pageCount={vendors.pageCount} total={vendors.total} rangeStart={vendors.rangeStart} rangeEnd={vendors.rangeEnd} onPage={vendors.setPage} />
      {query.isLoading ? <LoadingState label="Loading vendors…" description="Fetching the vendor list." /> : null}
      {!query.isLoading && vendors.total === 0 ? <p className="text-sm text-muted sm:mt-3">No vendors match this filter.</p> : null}
      <Modal open={open} title="Add a vendor" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={(event) => {
          event.preventDefault();
          const name = form.contactName.trim();
          if (name.length < 2 || !/^[\p{L}][\p{L}\s.'’-]*$/u.test(name)) {
            setError("Use letters, spaces, hyphens, and apostrophes only.");
            return;
          }
          if (form.phone.length > 0 && form.phone.length !== 10) {
            setError("Enter a 10-digit phone number.");
            return;
          }
          setError("");
          create.mutate();
        }}>
          <ErrorNote message={error} />
          <Field label="Vendor name"><input className={inputClass} required value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></Field>
          <Field label="Contact" hint="Letters, spaces, hyphens, and apostrophes only."><input className={inputClass} required value={form.contactName} autoComplete="name" onChange={(event) => setForm({ ...form, contactName: event.target.value.replace(/[^\p{L}\s.'’-]/gu, "") })} /></Field>
          <Field label="Email"><input className={inputClass} type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label="Phone" hint="10 digits."><input className={inputClass} inputMode="numeric" autoComplete="tel" maxLength={10} pattern="\d{10}" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} /></Field>
          <Field label="Exhibition">
            <select className={inputClass} required value={form.exhibitionId} onChange={(event) => setForm({ ...form, exhibitionId: event.target.value })}>
              <option value="">Select</option>
              {(exhibitions.data?.data ?? []).map((exhibition) => <option key={exhibition.id} value={exhibition.id}>{exhibition.name}</option>)}
            </select>
          </Field>
          <Field label="Form" hint="Assigns the form now. Use Send mail in the list to email the invitation once.">
            <select className={inputClass} required value={form.formVersionId} onChange={(event) => setForm({ ...form, formVersionId: event.target.value })}>
              <option value="">Select</option>
              {publishedForms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          {open && !forms.isLoading && publishedForms.length === 0 ? <p className="text-sm text-muted">Publish a form before adding a vendor.</p> : null}
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
          <Field label="Form" hint="This replaces the current form. After saving, use Send mail once from the list.">
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
          <p className="text-sm">Delete {removing?.companyName}? Open invitation links stop working, and the vendor leaves the directory.</p>
          <ModalActions>
            <Button type="button" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={remove.isPending}>Delete</Button>
          </ModalActions>
        </form>
      </Modal>
      <Modal open={confirmRemind} title="Send deadline reminder" onClose={() => { if (!sendReminders.isPending) setConfirmRemind(false); }}>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const assignmentIds = reminderAssignmentIds(selectedRemindable);
            if (!assignmentIds.length) {
              setError("Select at least one vendor with an open form assignment.");
              setConfirmRemind(false);
              return;
            }
            setError("");
            sendReminders.mutate(assignmentIds);
          }}
        >
          <ErrorNote message={error} />
          <p className="text-sm">
            Queue the Submission Deadline Reminder email for{" "}
            <strong>{selectedCount}</strong> vendor{selectedCount === 1 ? "" : "s"}?
            Closed assignments (approved, rejected, or revoked) are skipped.
          </p>
          {selectedCount === 1 && selectedRemindable[0] ? (
            <p className="text-sm text-muted">{selectedRemindable[0].companyName} · {selectedRemindable[0].email}</p>
          ) : null}
          <ModalActions>
            <Button type="button" disabled={sendReminders.isPending} onClick={() => setConfirmRemind(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={sendReminders.isPending || selectedCount === 0}>
              {sendReminders.isPending ? "Sending…" : "Send reminders"}
            </Button>
          </ModalActions>
        </form>
      </Modal>
      <Modal open={Boolean(importResult)} title="Upload summary" onClose={() => { setImportResult(null); setFormAssigned(false); }}>
        {importResult ? (
          <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); setError(""); assignImported.mutate(); }}>
            <ErrorNote message={error} />
            <p className="text-sm font-medium">{importResult.filename}</p>
            {importResult.rows?.length ? (
              <ul className="grid gap-1 text-sm text-muted">
                {importResult.rows.slice(0, 8).map((row) => (
                  <li key={row.rowNumber}>Row {row.rowNumber}: {row.messages.join(" ") || row.status}</li>
                ))}
              </ul>
            ) : null}
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div className="flex min-w-0 flex-col justify-between rounded-md bg-secondary px-2.5 py-2 sm:px-3"><dt className="text-xs leading-4 text-muted sm:text-sm">Transferred</dt><dd className="text-lg font-semibold">{importResult.createdCount}</dd></div>
              <div className="flex min-w-0 flex-col justify-between rounded-md bg-secondary px-2.5 py-2 sm:px-3"><dt className="text-xs leading-4 text-muted sm:text-sm">Skipped</dt><dd className="text-lg font-semibold">{importResult.skippedCount}</dd></div>
              <div className="flex min-w-0 flex-col justify-between rounded-md bg-secondary px-2.5 py-2 sm:px-3"><dt className="text-xs leading-4 text-muted sm:text-sm">Not transferred</dt><dd className="text-lg font-semibold">{importResult.errorCount}</dd></div>
            </dl>
            {importResult.createdVendorIds.length > 0 && !formAssigned ? (
              <>
                <p className="text-sm text-muted">Assign a form to everyone transferred in this file. Then use Send mail in the Vendors list to email each invitation once.</p>
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
                <Button type="submit" variant="primary" disabled={assignImported.isPending || !bulkFormId || !bulkExhibitionId}>Assign form</Button>
              </>
            ) : null}
            {formAssigned ? <p className="text-sm text-muted">Forms assigned. Close this window and press Send mail next to each vendor.</p> : null}
            {importResult.createdVendorIds.length === 0 ? <p className="text-sm text-muted">No new vendors were transferred, so there is nobody to assign.</p> : null}
            {importResult.errorCount > 0 ? <Button type="button" onClick={() => void download(`/imports/${importResult.id}/errors.csv`, "import-errors.csv")}>Download error report</Button> : null}
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
