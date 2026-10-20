"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { FormRenderer } from "@/components/form-renderer";
import { ApiError, api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Badge, Button, ErrorNote, Field, PageHeader, inputClass, statusTone } from "@/components/ui";
import type { FormSchemaDefinition } from "@vmp/shared";

type Review = {
  data: {
    id: string;
    status: string;
    lockVersion: number;
    vendor: { id: string; companyName: string; email: string; contactName: string };
    exhibition: { name: string; code: string; venue: string };
    form: { name: string; versionNumber: number; schema: FormSchemaDefinition };
    values: Record<string, unknown>;
    revisions: { id: string; revisionNumber: number; createdAt: string }[];
    notes: { id: string; body: string; createdAt: string }[];
    correction: { fields: { fieldId: string; note: string }[] } | null;
  };
};

export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["assignment", params.id], queryFn: () => api<Review>(`/assignments/${params.id}`) });
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const review = query.data?.data;

  const correct = useMutation({
    mutationFn: () => api(`/assignments/${params.id}/corrections`, {
      method: "POST",
      body: JSON.stringify({
        lockVersion: review?.lockVersion,
        fields: Object.entries(selected).filter(([, value]) => value.trim().length >= 3).map(([fieldId, value]) => ({ fieldId, note: value })),
      }),
    }),
    onSuccess: async () => { setError(""); await client.invalidateQueries({ queryKey: ["assignment", params.id] }); },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Correction request failed."),
  });
  const approve = useMutation({
    mutationFn: () => api(`/assignments/${params.id}/approve`, { method: "POST", body: JSON.stringify({ lockVersion: review?.lockVersion }) }),
    onSuccess: async () => { setError(""); await client.invalidateQueries({ queryKey: ["assignment", params.id] }); },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Approval failed."),
  });
  const addNote = useMutation({
    mutationFn: () => api(`/assignments/${params.id}/notes`, { method: "POST", body: JSON.stringify({ body: note }) }),
    onSuccess: async () => { setNote(""); await client.invalidateQueries({ queryKey: ["assignment", params.id] }); },
  });

  if (!review) return <p className="text-sm text-muted">Loading submission…</p>;
  const reviewable = review.status === "SUBMITTED_PENDING_REVIEW" || review.status === "RESUBMITTED_PENDING_REVIEW";
  return (
    <div>
      <PageHeader title={review.vendor.companyName} description={`${review.form.name} v${review.form.versionNumber} · ${review.exhibition.name}`} actions={<Badge tone={statusTone(review.status)}>{review.status}</Badge>} />
      <p className="mb-3 text-sm text-muted">{review.vendor.contactName} · {review.vendor.email} · {review.exhibition.venue}</p>
      <ErrorNote message={error} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <FormRenderer schema={review.form.schema} values={review.values} disabled editableFieldIds={[]} notes={review.correction?.fields} />
        <aside className="grid h-fit gap-3 rounded-lg border border-border bg-surface p-3">
          <h2 className="text-sm font-semibold">Decision</h2>
          {reviewable ? (
            <>
              <p className="text-xs text-muted">Select the fields the vendor may change and write a note for each one.</p>
              {review.form.schema.fields.filter((field) => field.type !== "heading" && field.type !== "info").map((field) => (
                <label key={field.id} className="grid gap-1 text-sm">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={field.id in selected} onChange={(event) => {
                      setSelected((current) => {
                        const next = { ...current };
                        if (event.target.checked) next[field.id] = current[field.id] ?? "";
                        else delete next[field.id];
                        return next;
                      });
                    }} />
                    {field.label}
                  </span>
                  {field.id in selected ? <textarea className={`${inputClass} min-h-16 py-2`} value={selected[field.id]} onChange={(event) => setSelected({ ...selected, [field.id]: event.target.value })} placeholder="What needs to change?" /> : null}
                </label>
              ))}
              <Button variant="primary" onClick={() => correct.mutate()} disabled={correct.isPending}>Request correction</Button>
              <Button onClick={() => approve.mutate()} disabled={approve.isPending}>Approve submission</Button>
            </>
          ) : <p className="text-sm text-muted">This submission is not waiting for a decision.</p>}
          <Link className="text-sm underline" href={`/admin/documents/vendors/${review.vendor.id}`}>Open document archive</Link>
          <h3 className="text-sm font-semibold">Internal notes</h3>
          <ul className="grid gap-2 text-sm">
            {review.notes.map((item) => <li key={item.id} className="rounded bg-secondary px-2 py-1">{item.body}<span className="mt-1 block text-xs text-muted">{formatDate(item.createdAt)}</span></li>)}
          </ul>
          <Field label="Add note"><textarea className={`${inputClass} min-h-16 py-2`} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
          <Button onClick={() => addNote.mutate()} disabled={!note.trim()}>Save note</Button>
          <h3 className="text-sm font-semibold">Revisions</h3>
          <ul className="text-sm text-muted">
            {review.revisions.map((revision) => <li key={revision.id}>Revision {revision.revisionNumber} · {formatDate(revision.createdAt)}</li>)}
          </ul>
        </aside>
      </div>
    </div>
  );
}
