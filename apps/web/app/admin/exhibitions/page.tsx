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
      <PageHeader title="Exhibitions" description="Open an event to follow questionnaires and PDF forms separately." actions={<Button variant="primary" onClick={() => setOpen(true)}>Add exhibition</Button>} />
      <ErrorNote message={query.isError ? "Could not load exhibitions." : ""} />
      {query.isLoading ? <p className="text-sm text-muted">Loading exhibitions…</p> : null}
      {!query.isLoading && exhibitions.total === 0 ? <EmptyState title="No exhibitions yet" body="Add an event, then assign vendors so you can track their form progress." /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {exhibitions.rows.map((row) => (
          <Link key={row.id} href={`/admin/exhibitions/${row.id}`} className="group rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{row.code}</p>
                <h2 className="mt-1 truncate text-lg font-semibold tracking-tight">{row.name}</h2>
              </div>
              <StatusBadge status={row.status} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
              <Meta icon={<MapPin size={14} aria-hidden />} label="Venue" value={row.venue || "—"} />
              <Meta icon={<Users size={14} aria-hidden />} label="Vendors" value={String(row._count.vendors)} />
              <Meta icon={<CalendarRange size={14} aria-hidden />} label="Starts" value={formatDate(row.startsAt)} />
            </div>
            <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
              Open event
              <ChevronRight size={16} className="transition group-hover:translate-x-0.5" aria-hidden />
            </p>
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

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted">{icon}{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
