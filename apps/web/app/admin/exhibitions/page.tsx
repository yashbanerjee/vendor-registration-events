"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { EventProgressBoard, type VendorProgress } from "@/components/event-progress-board";
import { Button, EmptyState, ErrorNote, Field, LoadingState, Modal, ModalActions, Notice, PageHeader, inputClass } from "@/components/ui";

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

type ExhibitionDetail = {
  data: {
    id: string;
    name: string;
    code: string;
    vendors: VendorProgress[];
  };
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
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exhibition | null>(null);
  const [removing, setRemoving] = useState<Exhibition | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<ExhibitionForm>(emptyForm);

  const list = useQuery({ queryKey: ["exhibitions"], queryFn: () => api<{ data: Exhibition[] }>("/exhibitions") });
  const exhibitions = list.data?.data ?? [];

  useEffect(() => {
    if (!exhibitions.length) {
      setSelectedId("");
      return;
    }
    if (!selectedId || !exhibitions.some((row) => row.id === selectedId)) {
      setSelectedId(exhibitions[0].id);
    }
  }, [exhibitions, selectedId]);

  const detail = useQuery({
    queryKey: ["exhibition", selectedId],
    queryFn: () => api<ExhibitionDetail>(`/exhibitions/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const selected = exhibitions.find((row) => row.id === selectedId) ?? null;

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
    onSuccess: async (response) => {
      const saved = (response as { data?: Exhibition })?.data;
      setNotice(editing ? `${form.name} updated.` : `${form.name} created.`);
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setError("");
      await client.invalidateQueries({ queryKey: ["exhibitions"] });
      if (saved?.id) {
        setSelectedId(saved.id);
        await client.invalidateQueries({ queryKey: ["exhibition", saved.id] });
      } else if (editing?.id) {
        await client.invalidateQueries({ queryKey: ["exhibition", editing.id] });
      }
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not save the event."),
  });

  const remove = useMutation({
    mutationFn: () => api("/exhibitions/archive", { method: "POST", body: JSON.stringify({ ids: [removing?.id] }) }),
    onSuccess: async () => {
      const removedId = removing?.id;
      setNotice(`${removing?.name ?? "Event"} deleted.`);
      setRemoving(null);
      setError("");
      await client.invalidateQueries({ queryKey: ["exhibitions"] });
      if (removedId && selectedId === removedId) setSelectedId("");
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

  const actions = (
    <>
      {selected ? (
        <>
          <Button onClick={() => openEdit(selected)}>Edit</Button>
          <Button
            variant="danger"
            onClick={() => {
              setError("");
              setRemoving(selected);
            }}
          >
            Delete
          </Button>
        </>
      ) : null}
      <Button variant="primary" onClick={openCreate}>
        Add event
      </Button>
    </>
  );

  return (
    <div>
      {exhibitions.length > 1 ? (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 sm:mb-5">
          <label className="grid w-full gap-1.5 sm:w-auto">
            <span className="eyebrow">Event</span>
            <select
              className={`${inputClass} sm:min-w-[16rem]`}
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              aria-label="Select event"
            >
              {exhibitions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} ({row.code})
                </option>
              ))}
            </select>
          </label>
          <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>
        </div>
      ) : (
        <PageHeader eyebrow={selected?.code} title={selected?.name ?? "Events"} actions={actions} />
      )}

      <ErrorNote className="mb-3" message={list.isError ? "Could not load events." : error && !open && !removing ? error : ""} />
      <Notice message={notice} />

      {list.isLoading ? <LoadingState label="Loading events…" description="Fetching exhibition details." /> : null}
      {!list.isLoading && exhibitions.length === 0 ? (
        <EmptyState title="No events yet" body="Add the show first. You can add companies and forms after that." action={<Button variant="primary" onClick={openCreate}>Add event</Button>} />
      ) : null}

      {selectedId ? (
        <>
          {detail.isLoading ? <LoadingState label="Loading progress…" description="Fetching companies and form answers." /> : null}
          <ErrorNote className="mb-3" message={detail.isError ? "Could not load company progress for this event." : ""} />
          {detail.data?.data ? <EventProgressBoard vendors={detail.data.data.vendors} /> : null}
        </>
      ) : null}

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
          <ModalActions>
            <Button type="button" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={remove.isPending}>{remove.isPending ? "Deleting…" : "Delete"}</Button>
          </ModalActions>
        </form>
      </Modal>
    </div>
  );
}
