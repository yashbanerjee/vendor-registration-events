"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Pager, usePagedRows } from "@/components/pager";
import { Button, EmptyState, ErrorNote, Field, Modal, PageHeader, StatusBadge, inputClass } from "@/components/ui";

type Exhibition = { id: string; name: string; code: string; venue: string; startsAt: string; endsAt: string; status: string; _count: { vendors: number; assignments: number } };

export default function ExhibitionsPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", code: "", venue: "", startsAt: "", endsAt: "" });
  const query = useQuery({ queryKey: ["exhibitions"], queryFn: () => api<{ data: Exhibition[] }>("/exhibitions") });
  const exhibitions = usePagedRows(query.data?.data ?? []);
  const create = useMutation({
    mutationFn: () => api("/exhibitions", { method: "POST", body: JSON.stringify({ ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), status: "PUBLISHED" }) }),
    onSuccess: async () => { setOpen(false); setForm({ name: "", code: "", venue: "", startsAt: "", endsAt: "" }); await client.invalidateQueries({ queryKey: ["exhibitions"] }); },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not save the exhibition."),
  });
  return (
    <div>
      <PageHeader title="Events" description="Each show is one event. Open it to see who is filling the form and which PDFs they sent." actions={<Button variant="primary" onClick={() => setOpen(true)}>Add event</Button>} />
      <ErrorNote message={query.isError ? "Could not load exhibitions." : ""} />
      {query.isLoading ? <p className="text-sm text-muted">Loading exhibitions…</p> : null}
      {!query.isLoading && exhibitions.total === 0 ? <EmptyState title="No events yet" body="Add the show first. You can add companies and forms after that." /> : null}
      {exhibitions.total > 0 ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Exhibition</th>
                <th>Status</th>
                <th>Venue</th>
                <th>Vendors</th>
                <th>Starts</th>
              </tr>
            </thead>
            <tbody>
              {exhibitions.rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap text-muted">{row.code}</td>
                  <td><Link className="font-medium underline" href={`/admin/exhibitions/${row.id}`}>{row.name}</Link></td>
                  <td><StatusBadge status={row.status} /></td>
                  <td>{row.venue || "—"}</td>
                  <td>{row._count.vendors}</td>
                  <td className="whitespace-nowrap">{formatDate(row.startsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <Pager page={exhibitions.page} pageCount={exhibitions.pageCount} total={exhibitions.total} rangeStart={exhibitions.rangeStart} rangeEnd={exhibitions.rangeEnd} onPage={exhibitions.setPage} />
      <Modal open={open} title="Add event" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <ErrorNote message={error} />
          <Field label="Name"><input className={inputClass} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Code"><input className={inputClass} required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
          <Field label="Venue"><input className={inputClass} value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} /></Field>
          <Field label="Starts"><input className={inputClass} type="datetime-local" required value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></Field>
          <Field label="Ends"><input className={inputClass} type="datetime-local" required value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></Field>
          <Button type="submit" variant="primary">Save event</Button>
        </form>
      </Modal>
    </div>
  );
}
