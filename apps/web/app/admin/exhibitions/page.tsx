"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Button, ErrorNote, Field, Modal, PageHeader, inputClass } from "@/components/ui";

type Exhibition = { id: string; name: string; code: string; venue: string; startsAt: string; endsAt: string; status: string; _count: { vendors: number; assignments: number } };

export default function ExhibitionsPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", code: "", venue: "", startsAt: "", endsAt: "" });
  const query = useQuery({ queryKey: ["exhibitions"], queryFn: () => api<{ data: Exhibition[] }>("/exhibitions") });
  const create = useMutation({
    mutationFn: () => api("/exhibitions", { method: "POST", body: JSON.stringify({ ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), status: "PUBLISHED" }) }),
    onSuccess: async () => { setOpen(false); await client.invalidateQueries({ queryKey: ["exhibitions"] }); },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not save the exhibition."),
  });
  return (
    <div>
      <PageHeader title="Exhibitions" description="Events that vendors are assigned to." actions={<Button variant="primary" onClick={() => setOpen(true)}>Add exhibition</Button>} />
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Name</th><th>Code</th><th>Venue</th><th>Vendors</th><th>Assignments</th></tr></thead>
          <tbody>
            {(query.data?.data ?? []).map((row) => (
              <tr key={row.id}><td>{row.name}</td><td>{row.code}</td><td>{row.venue}</td><td>{row._count.vendors}</td><td>{row._count.assignments}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
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
