"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Pager, usePagedRows } from "@/components/pager";
import { Button, EmptyState, ErrorNote, Field, LoadingState, Modal, Notice, PageHeader, StatusBadge, inputClass } from "@/components/ui";

type Exhibition = {
  id: string;
  name: string;
  code: string;
  venue: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  status: string;
  _count: { vendors: number; assignments: number };
};

type ExhibitionForm = {
  name: string;
  code: string;
  venue: string;
  description: string;
  startsAt: string;
  endsAt: string;
  status: "DRAFT" | "PUBLISHED";
};

const emptyForm: ExhibitionForm = {
  name: "",
  code: "",
  venue: "",
  description: "",
  startsAt: "",
  endsAt: "",
  status: "PUBLISHED",
};

function toLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ExhibitionsPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exhibition | null>(null);
  const [removing, setRemoving] = useState<Exhibition | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<ExhibitionForm>(emptyForm);
  const query = useQuery({ queryKey: ["exhibitions"], queryFn: () => api<{ data: Exhibition[] }>("/exhibitions") });
  const exhibitions = usePagedRows(query.data?.data ?? []);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
      };
      return editing
        ? api(`/exhibitions/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : api("/exhibitions", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: async () => {
      setNotice(editing ? `${form.name} updated.` : `${form.name} created.`);
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setError("");
      await client.invalidateQueries({ queryKey: ["exhibitions"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not save the event."),
  });

  const remove = useMutation({
    mutationFn: () => api("/exhibitions/archive", { method: "POST", body: JSON.stringify({ ids: [removing?.id] }) }),
    onSuccess: async () => {
      setNotice(`${removing?.name ?? "Event"} deleted.`);
      setRemoving(null);
      setError("");
      await client.invalidateQueries({ queryKey: ["exhibitions"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not delete the event."),
  });

  function openCreate() {
    setError("");
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: Exhibition) {
    setError("");
    setEditing(row);
    setForm({
      name: row.name,
      code: row.code,
      venue: row.venue || "",
      description: row.description || "",
      startsAt: toLocalInput(row.startsAt),
      endsAt: toLocalInput(row.endsAt),
      status: row.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
    });
    setOpen(true);
  }

  return (
    <div>
      <PageHeader title="Events" description="Each show is one event. Open it to see who is filling the form and which PDFs they sent." actions={<Button variant="primary" onClick={openCreate}>Add event</Button>} />
      <ErrorNote message={query.isError ? "Could not load exhibitions." : error && !open && !removing ? error : ""} />
      <Notice message={notice} />
      {query.isLoading ? <LoadingState label="Loading events…" description="Fetching exhibition details." /> : null}
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
                <th></th>
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
                  <td className="text-right">
                    <div className="inline-flex gap-2">
                      <Button size="sm" onClick={() => openEdit(row)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => { setError(""); setRemoving(row); }}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <Pager page={exhibitions.page} pageCount={exhibitions.pageCount} total={exhibitions.total} rangeStart={exhibitions.rangeStart} rangeEnd={exhibitions.rangeEnd} onPage={exhibitions.setPage} />

      <Modal open={open} title={editing ? "Edit event" : "Add event"} onClose={() => { setOpen(false); setEditing(null); setError(""); }}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <ErrorNote message={error} />
          <Field label="Name"><input className={inputClass} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Code"><input className={inputClass} required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} disabled={Boolean(editing)} /></Field>
          <Field label="Venue"><input className={inputClass} value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} /></Field>
          <Field label="Starts"><input className={inputClass} type="datetime-local" required value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></Field>
          <Field label="Ends"><input className={inputClass} type="datetime-local" required value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ExhibitionForm["status"] })}>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </select>
          </Field>
          <Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? "Saving…" : editing ? "Save changes" : "Save event"}</Button>
        </form>
      </Modal>

      <Modal open={Boolean(removing)} title="Delete event" onClose={() => setRemoving(null)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); remove.mutate(); }}>
          <ErrorNote message={error} />
          <p className="text-sm">
            Delete {removing?.name}? It leaves this list. Open invitations and unfinished forms for this event are closed. Submitted answers stay on record.
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={remove.isPending}>{remove.isPending ? "Deleting…" : "Delete"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
