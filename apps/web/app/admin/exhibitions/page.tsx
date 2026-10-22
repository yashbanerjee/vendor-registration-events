"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, ChevronRight, MapPin, Users } from "lucide-react";
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
      <PageHeader title="Exhibitions" description="Open an event to see every vendor and which form fields are done or still open." actions={<Button variant="primary" onClick={() => setOpen(true)}>Add exhibition</Button>} />
      <ErrorNote message={query.isError ? "Could not load exhibitions." : ""} />
      {query.isLoading ? <p className="text-sm text-muted">Loading exhibitions…</p> : null}
      {!query.isLoading && exhibitions.total === 0 ? <EmptyState title="No exhibitions yet" body="Add an event, then assign vendors so you can track their form progress." /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {exhibitions.rows.map((row) => (
          <Link key={row.id} href={`/admin/exhibitions/${row.id}`} className="group overflow-hidden rounded-lg border border-border bg-surface transition hover:border-brand">
            <div className="h-1 bg-brand" />
            <div className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold tracking-tight">{row.name}</h2>
                  <StatusBadge status={row.status} />
                </div>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">{row.code}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  {row.venue ? <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden />{row.venue}</span> : null}
                  <span className="inline-flex items-center gap-1"><CalendarRange size={14} aria-hidden />{formatDate(row.startsAt)} – {formatDate(row.endsAt)}</span>
                  <span className="inline-flex items-center gap-1"><Users size={14} aria-hidden />{row._count.vendors} vendors</span>
                </div>
              </div>
              <ChevronRight className="mt-1 shrink-0 text-muted transition group-hover:text-brand" size={18} aria-hidden />
            </div>
          </Link>
        ))}
      </div>
      <Pager page={exhibitions.page} pageCount={exhibitions.pageCount} total={exhibitions.total} rangeStart={exhibitions.rangeStart} rangeEnd={exhibitions.rangeEnd} onPage={exhibitions.setPage} />
      <Modal open={open} title="Add exhibition" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <ErrorNote message={error} />
          <Field label="Name"><input className={inputClass} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Code"><input className={inputClass} required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
          <Field label="Venue"><input className={inputClass} value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} /></Field>
          <Field label="Starts"><input className={inputClass} type="datetime-local" required value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></Field>
          <Field label="Ends"><input className={inputClass} type="datetime-local" required value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></Field>
          <Button type="submit" variant="primary">Save exhibition</Button>
        </form>
      </Modal>
    </div>
  );
}
