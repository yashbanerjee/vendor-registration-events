"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { InlineFilePreview, RemoteFileLink } from "@/components/file-preview";
import { Pager, usePagedRows } from "@/components/pager";
import { Button, ErrorNote, Field, Notice, PageHeader, StatusBadge, inputClass } from "@/components/ui";
import { COUNTRIES, isFieldVisible, type FormField, type FormSchemaDefinition } from "@vmp/shared";

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
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const review = query.data?.data;
  const markedIds = Object.entries(marked).filter(([, on]) => on).map(([fieldId]) => fieldId);
  const readyFields = markedIds
    .filter((fieldId) => (comments[fieldId] ?? "").trim().length >= 3)
    .map((fieldId) => ({ fieldId, note: comments[fieldId].trim() }));

  const correct = useMutation({
    mutationFn: () => {
      if (markedIds.length === 0) throw new Error("Mark at least one field.");
      if (readyFields.length !== markedIds.length) throw new Error("Write a comment on every marked field.");
      return api<Review>(`/assignments/${params.id}/corrections`, {
        method: "POST",
        body: JSON.stringify({
          lockVersion: review?.lockVersion,
          fields: readyFields,
        }),
      });
    },
    onSuccess: async (result) => {
      setError("");
      setMarked({});
      setComments({});
      setMessage(`One email was sent to ${review?.vendor.email} with ${readyFields.length} field${readyFields.length === 1 ? "" : "s"} and the comments.`);
      client.setQueryData(["assignment", params.id], result);
      await client.invalidateQueries({ queryKey: ["reviews"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : "Correction request failed."),
  });
  const approve = useMutation({
    mutationFn: () => api<Review>(`/assignments/${params.id}/approve`, { method: "POST", body: JSON.stringify({ lockVersion: review?.lockVersion }) }),
    onSuccess: async (result) => {
      setError("");
      setMessage("Accepted. The status is now approved.");
      client.setQueryData(["assignment", params.id], result);
      await client.invalidateQueries({ queryKey: ["reviews"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Approval failed."),
  });
  const addNote = useMutation({
    mutationFn: () => api(`/assignments/${params.id}/notes`, { method: "POST", body: JSON.stringify({ body: note }) }),
    onSuccess: async () => { setNote(""); await client.invalidateQueries({ queryKey: ["assignment", params.id] }); },
  });

  const notes = usePagedRows(review?.notes ?? []);
  const revisions = usePagedRows(review?.revisions ?? []);
  if (!review) return <p className="text-sm text-muted">Loading submission…</p>;
  const reviewable = review.status === "SUBMITTED_PENDING_REVIEW" || review.status === "RESUBMITTED_PENDING_REVIEW";
  return (
    <div>
      <PageHeader title={review.vendor.companyName} description={`${review.form.name} v${review.form.versionNumber} · ${review.exhibition.name}`} actions={<StatusBadge status={review.status} />} />
      <p className="mb-3 text-sm text-muted">{review.vendor.contactName} · {review.vendor.email} · {review.exhibition.venue}</p>
      <ErrorNote message={error} />
      <Notice message={message} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-4">
          {reviewable ? <p className="text-sm text-muted">Each answer is shown below. Mark a field that needs a change and write a comment on that field. The vendor gets one email with every marked field and its comment.</p> : null}
          <AnswerList
            schema={review.form.schema}
            values={review.values}
            previous={review.correction?.fields ?? []}
            reviewable={reviewable}
            marked={marked}
            comments={comments}
            onMark={(fieldId, on) => setMarked((current) => ({ ...current, [fieldId]: on }))}
            onComment={(fieldId, value) => {
              setComments((current) => ({ ...current, [fieldId]: value }));
              if (value.trim()) setMarked((current) => ({ ...current, [fieldId]: true }));
            }}
          />
        </div>
        <aside className="grid h-fit gap-3 rounded-lg border border-border bg-surface p-3">
          <h2 className="text-sm font-semibold">Decision</h2>
          {reviewable ? (
            <>
              <p className="text-xs text-muted">{markedIds.length === 0 ? "No fields marked." : `${readyFields.length} of ${markedIds.length} marked fields have a comment.`}</p>
              <Button variant="primary" onClick={() => correct.mutate()} disabled={correct.isPending || markedIds.length === 0 || readyFields.length !== markedIds.length}>Request correction</Button>
              <Button onClick={() => approve.mutate()} disabled={approve.isPending}>Approve submission</Button>
            </>
          ) : <p className="text-sm text-muted">This submission is not waiting for a decision.</p>}
          <Link className="text-sm underline" href={`/admin/documents/vendors/${review.vendor.id}`}>Open document archive</Link>
          <h3 className="text-sm font-semibold">Internal notes</h3>
          <ul className="grid gap-2 text-sm">
            {notes.rows.map((item) => <li key={item.id} className="rounded bg-secondary px-2 py-1">{item.body}<span className="mt-1 block text-xs text-muted">{formatDate(item.createdAt)}</span></li>)}
          </ul>
          <Pager page={notes.page} pageCount={notes.pageCount} total={notes.total} rangeStart={notes.rangeStart} rangeEnd={notes.rangeEnd} onPage={notes.setPage} />
          <Field label="Add note"><textarea className={`${inputClass} min-h-16 py-2`} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
          <Button onClick={() => addNote.mutate()} disabled={!note.trim()}>Save note</Button>
          <h3 className="text-sm font-semibold">Revisions</h3>
          <ul className="text-sm text-muted">
            {revisions.rows.map((revision) => <li key={revision.id}>Revision {revision.revisionNumber} · {formatDate(revision.createdAt)}</li>)}
          </ul>
          <Pager page={revisions.page} pageCount={revisions.pageCount} total={revisions.total} rangeStart={revisions.rangeStart} rangeEnd={revisions.rangeEnd} onPage={revisions.setPage} />
        </aside>
      </div>
    </div>
  );
}

function AnswerList({
  schema,
  values,
  previous,
  reviewable,
  marked,
  comments,
  onMark,
  onComment,
}: {
  schema: FormSchemaDefinition;
  values: Record<string, unknown>;
  previous: { fieldId: string; note: string }[];
  reviewable: boolean;
  marked: Record<string, boolean>;
  comments: Record<string, string>;
  onMark: (fieldId: string, on: boolean) => void;
  onComment: (fieldId: string, value: string) => void;
}) {
  const byId = new Map(schema.fields.map((field) => [field.id, field]));
  const sections = [...schema.sections].sort((a, b) => a.order - b.order);
  return (
    <div className="grid gap-4">
      {sections.map((section) => {
        const fields = schema.fields.filter((field) => field.sectionId === section.id).sort((a, b) => a.order - b.order).filter((field) => isFieldVisible(field, values, byId));
        return (
          <section key={section.id} className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-base font-semibold">{section.title}</h2>
            {section.description ? <p className="mt-1 text-sm text-muted">{section.description}</p> : null}
            <div className="mt-4 grid gap-4">
              {fields.map((field) => {
                if (field.type === "heading") return <h3 key={field.id} className="text-sm font-semibold">{field.label}</h3>;
                if (field.type === "info") return <p key={field.id} className="text-sm text-muted">{field.description || field.label}</p>;
                const earlier = previous.find((item) => item.fieldId === field.id)?.note;
                const on = Boolean(marked[field.id]);
                return (
                  <article key={field.id} className={`grid gap-2 rounded-md border p-3 ${on ? "border-brand bg-[var(--badge-info-bg)]" : "border-border"}`}>
                    <h3 className="text-sm font-semibold">{field.label}</h3>
                    <Answer field={field} value={values[field.id]} />
                    {earlier ? <p className="text-sm text-[var(--badge-warning-fg)]">Previous comment: {earlier}</p> : null}
                    {reviewable ? (
                      <div className="grid gap-2 border-t border-border pt-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={on} onChange={(event) => onMark(field.id, event.target.checked)} />
                          Mark this field
                        </label>
                        <Field label="Comment">
                          <textarea className={`${inputClass} min-h-16 bg-surface py-2`} value={comments[field.id] ?? ""} onChange={(event) => onComment(field.id, event.target.value)} placeholder="Tell the vendor what to change" />
                        </Field>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Answer({ field, value }: { field: FormField; value: unknown }) {
  const text = displayAnswer(field, value);
  if (!text) return <p className="text-sm text-muted">Not answered</p>;
  if (field.type === "reupload") {
    const files = fileEntries(value);
    return (
      <div className="grid gap-3 text-sm">
        {field.template?.assetId && field.template.filename ? (
          <div>
            <p className="text-xs text-muted">File provided to the vendor</p>
            <RemoteFileLink path={`/form-assets/${field.template.assetId}/content`} filename={field.template.filename} />
          </div>
        ) : null}
        {files.length === 0 ? <p className="text-sm text-muted">Not answered</p> : (
          <ul className="grid gap-1">
            {files.map((file) => (
              <li key={file.documentId || file.filename}>
                <p className="text-xs text-muted">Completed file</p>
                {file.documentId ? <InlineFilePreview documentId={file.documentId} filename={file.filename} /> : file.filename}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (field.type === "file" || field.type === "image" || field.type === "files") {
    const files = fileEntries(value);
    if (files.length === 0) return <p className="text-sm text-muted">Not answered</p>;
    return (
      <ul className="grid gap-1 text-sm">
        {files.map((file) => (
          <li key={file.documentId || file.filename}>
            {file.documentId ? <InlineFilePreview documentId={file.documentId} filename={file.filename} /> : file.filename}
          </li>
        ))}
      </ul>
    );
  }
  return <p className="whitespace-pre-wrap text-sm">{text}</p>;
}

function displayAnswer(field: FormField, value: unknown): string {
  if (value == null || value === "") return "";
  if (field.type === "toggle") return value ? "Yes" : "No";
  if (field.type === "country" && typeof value === "string") return COUNTRIES.find((country) => country.code === value)?.name ?? value;
  if ((field.type === "select" || field.type === "radio") && typeof value === "string") {
    return field.options?.find((option) => option.value === value)?.label ?? value;
  }
  if ((field.type === "multiselect" || field.type === "checkbox") && Array.isArray(value)) {
    return value.map((item) => field.options?.find((option) => option.value === String(item))?.label ?? String(item)).join(", ");
  }
  if (Array.isArray(value)) return value.map((item) => (typeof item === "object" ? fileName(item) : String(item))).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("filename" in record) return fileName(record);
    return Object.values(record).filter((item) => item != null && item !== "").map(String).join(", ");
  }
  return String(value);
}

function fileEntries(value: unknown): { documentId: string; filename: string }[] {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { documentId?: unknown; filename?: unknown };
    const filename = typeof record.filename === "string" && record.filename ? record.filename : "Uploaded file";
    const documentId = typeof record.documentId === "string" ? record.documentId : "";
    return [{ documentId, filename }];
  });
}

function fileName(value: unknown) {
  if (!value || typeof value !== "object" || !("filename" in value)) return "";
  const name = (value as { filename?: unknown }).filename;
  return typeof name === "string" ? name : "Uploaded file";
}
