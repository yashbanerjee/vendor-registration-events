"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Pager, usePagedRows } from "@/components/pager";
import { Button, ErrorNote, Field, Modal, PageHeader, StatusBadge, inputClass } from "@/components/ui";

type QueueItem = { id: string; status: string; vendor: { companyName: string }; exhibition: { name: string }; form: { name: string }; submittedAt: string | null };
type Option = { id: string; name?: string; companyName?: string; code?: string; versions?: { id: string; versionNumber: number }[] };

export default function ReviewsPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ vendorId: "", exhibitionId: "", formVersionId: "", deadline: "" });
  const queue = useQuery({ queryKey: ["reviews"], queryFn: () => api<{ data: QueueItem[] }>("/reviews") });
  const reviews = usePagedRows(queue.data?.data ?? []);
  const vendors = useQuery({ queryKey: ["vendors", "assign"], queryFn: () => api<{ data: Option[] }>("/vendors?limit=100"), enabled: open });
  const exhibitions = useQuery({ queryKey: ["exhibitions"], queryFn: () => api<{ data: Option[] }>("/exhibitions"), enabled: open });
  const forms = useQuery({ queryKey: ["forms"], queryFn: () => api<{ data: Option[] }>("/forms"), enabled: open });
  const assign = useMutation({
    mutationFn: () => api("/assignments", { method: "POST", body: JSON.stringify({ ...form, deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined }) }),
    onSuccess: async () => { setOpen(false); setError(""); await client.invalidateQueries({ queryKey: ["reviews"] }); },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not assign the form."),
  });
  return (
    <div>
      <PageHeader title="Review queue" description="Submissions waiting for approval or correction." actions={<Button variant="primary" onClick={() => setOpen(true)}>Assign form</Button>} />
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Vendor</th><th>Exhibition</th><th>Form</th><th>Status</th></tr></thead>
          <tbody>
            {reviews.rows.map((row) => (
              <tr key={row.id}>
                <td><Link className="font-medium underline" href={`/admin/reviews/${row.id}`}>{row.vendor.companyName}</Link></td>
                <td>{row.exhibition.name}</td>
                <td>{row.form.name}</td>
                <td><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={reviews.page} pageCount={reviews.pageCount} total={reviews.total} rangeStart={reviews.rangeStart} rangeEnd={reviews.rangeEnd} onPage={reviews.setPage} />
      {reviews.total === 0 && !queue.isLoading ? <p className="mt-3 text-sm text-muted">The queue is empty.</p> : null}
      <Modal open={open} title="Assign a published form" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); assign.mutate(); }}>
          <ErrorNote message={error} />
          <Field label="Vendor">
            <select className={inputClass} required value={form.vendorId} onChange={(event) => setForm({ ...form, vendorId: event.target.value })}>
              <option value="">Select</option>
              {(vendors.data?.data ?? []).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.companyName}</option>)}
            </select>
          </Field>
          <Field label="Exhibition">
            <select className={inputClass} required value={form.exhibitionId} onChange={(event) => setForm({ ...form, exhibitionId: event.target.value })}>
              <option value="">Select</option>
              {(exhibitions.data?.data ?? []).map((exhibition) => <option key={exhibition.id} value={exhibition.id}>{exhibition.name}</option>)}
            </select>
          </Field>
          <Field label="Published version">
            <select className={inputClass} required value={form.formVersionId} onChange={(event) => setForm({ ...form, formVersionId: event.target.value })}>
              <option value="">Select</option>
              {(forms.data?.data ?? []).flatMap((item) => (item.versions ?? []).map((version) => (
                <option key={version.id} value={version.id}>{item.name} v{version.versionNumber}</option>
              )))}
            </select>
          </Field>
          <Field label="Deadline"><input className={inputClass} type="datetime-local" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></Field>
          <Button type="submit" variant="primary" disabled={assign.isPending}>Send invitation</Button>
        </form>
      </Modal>
    </div>
  );
}
