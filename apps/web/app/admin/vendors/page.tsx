"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Badge, Button, ErrorNote, Field, Modal, PageHeader, inputClass, statusTone } from "@/components/ui";

type Vendor = {
  id: string;
  reference: string;
  companyName: string;
  contactName: string;
  email: string;
  category: string;
  status: string;
  assignments: { id: string; status: string }[];
};

const helper = createColumnHelper<Vendor>();

export default function VendorsPage() {
  const client = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ companyName: "", contactName: "", email: "", category: "", phone: "" });
  const query = useQuery({
    queryKey: ["vendors", q],
    queryFn: () => api<{ data: Vendor[] }>(`/vendors?q=${encodeURIComponent(q)}`),
  });
  const create = useMutation({
    mutationFn: () => api("/vendors", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: async () => {
      setOpen(false);
      setForm({ companyName: "", contactName: "", email: "", category: "", phone: "" });
      await client.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not create the vendor."),
  });
  const columns = useMemo(
    () => [
      helper.accessor("companyName", { header: "Company", cell: (info) => <Link className="font-medium underline" href={`/admin/vendors/${info.row.original.id}`}>{info.getValue()}</Link> }),
      helper.accessor("reference", { header: "Reference" }),
      helper.accessor("contactName", { header: "Contact" }),
      helper.accessor("email", { header: "Email" }),
      helper.accessor("category", { header: "Category" }),
      helper.accessor("status", { header: "Status", cell: (info) => <Badge tone={statusTone(info.getValue())}>{info.getValue()}</Badge> }),
      helper.display({ id: "forms", header: "Forms", cell: (info) => info.row.original.assignments.length }),
    ],
    [],
  );
  const table = useReactTable({ data: query.data?.data ?? [], columns, getCoreRowModel: getCoreRowModel() });
  return (
    <div>
      <PageHeader title="Vendors" description="Directory of exhibiting companies and their onboarding status." actions={<Button variant="primary" onClick={() => setOpen(true)}>Add vendor</Button>} />
      <input className={`${inputClass} mb-3 max-w-sm`} placeholder="Search company, email, or reference" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Filter vendors" />
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
          <Button type="submit" variant="primary" disabled={create.isPending}>Create vendor</Button>
        </form>
      </Modal>
    </div>
  );
}
