"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Pager, usePagedRows } from "@/components/pager";
import { Badge, ErrorNote, FilterBar, LoadingState, PageHeader, StatusBadge, inputClass } from "@/components/ui";

type FieldFill = { id: string; label: string; filled: boolean };
type SubmissionRow = {
  id: string | null;
  status: string;
  submitted: boolean;
  submittedAt: string | null;
  vendor: { id: string; reference: string; companyName: string; contactName: string; email: string };
  exhibition: { id: string; name: string } | null;
  form: { versionId: string; name: string; versionNumber: number } | null;
  fields: FieldFill[];
  filledCount: number;
  fieldCount: number;
};

export default function SubmissionsPage() {
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [exhibitionId, setExhibitionId] = useState("");
  const [formVersionId, setFormVersionId] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [fieldState, setFieldState] = useState("");
  const query = useQuery({ queryKey: ["submissions"], queryFn: () => api<{ data: SubmissionRow[] }>("/submissions") });
  const rows = query.data?.data ?? [];
  const exhibitions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) if (row.exhibition) seen.set(row.exhibition.id, row.exhibition.name);
    return [...seen].sort((left, right) => left[1].localeCompare(right[1]));
  }, [rows]);
  const forms = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) if (row.form) seen.set(row.form.versionId, `${row.form.name} v${row.form.versionNumber}`);
    return [...seen].sort((left, right) => left[1].localeCompare(right[1]));
  }, [rows]);
  const fields = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (formVersionId && row.form?.versionId !== formVersionId) continue;
      const formName = row.form ? `${row.form.name} v${row.form.versionNumber}` : "";
      for (const field of row.fields) seen.set(field.id, formName ? `${field.label} · ${formName}` : field.label);
    }
    return [...seen].sort((left, right) => left[1].localeCompare(right[1]));
  }, [rows, formVersionId]);
  const filtered = rows.filter((row) => {
    const haystack = `${row.vendor.companyName} ${row.vendor.email} ${row.vendor.contactName} ${row.vendor.reference}`.toLowerCase();
    if (q.trim() && !haystack.includes(q.trim().toLowerCase())) return false;
    if (state === "submitted" && !row.submitted) return false;
    if (state === "missing" && row.submitted) return false;
    if (exhibitionId && row.exhibition?.id !== exhibitionId) return false;
    if (formVersionId && row.form?.versionId !== formVersionId) return false;
    if (fieldId) {
      const field = row.fields.find((item) => item.id === fieldId);
      if (!field) return false;
      if (fieldState === "filled" && !field.filled) return false;
      if (fieldState === "empty" && field.filled) return false;
    }
    return true;
  });
  const page = usePagedRows(filtered, `${q}|${state}|${exhibitionId}|${formVersionId}|${fieldId}|${fieldState}`);
  const submittedCount = filtered.filter((row) => row.submitted).length;

  return (
    <div>
      <PageHeader title="Submissions" description="See which vendors have sent their form, which have not, and which fields are filled in." />
      <FilterBar>
        <input className={`${inputClass} col-span-2 sm:max-w-sm`} placeholder="Search vendor, contact, or email" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Search submissions" />
        <select className={`${inputClass} sm:max-w-[180px]`} aria-label="Submission" value={state} onChange={(event) => setState(event.target.value)}>
          <option value="">All vendors</option>
          <option value="submitted">Submitted</option>
          <option value="missing">Not submitted</option>
        </select>
        <select className={`${inputClass} sm:max-w-xs`} aria-label="Exhibition" value={exhibitionId} onChange={(event) => setExhibitionId(event.target.value)}>
          <option value="">All exhibitions</option>
          {exhibitions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select
          className={`${inputClass} sm:max-w-xs`}
          aria-label="Form"
          value={formVersionId}
          onChange={(event) => {
            setFormVersionId(event.target.value);
            setFieldId("");
            setFieldState("");
          }}
        >
          <option value="">All forms</option>
          {forms.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select
          className={`${inputClass} sm:max-w-xs`}
          aria-label="Form field"
          value={fieldId}
          onChange={(event) => {
            setFieldId(event.target.value);
            if (!event.target.value) setFieldState("");
          }}
        >
          <option value="">All fields</option>
          {fields.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select className={`${inputClass} col-span-2 sm:max-w-[160px]`} aria-label="Field status" value={fieldState} disabled={!fieldId} onChange={(event) => setFieldState(event.target.value)}>
          <option value="">Filled or empty</option>
          <option value="filled">Filled</option>
          <option value="empty">Empty</option>
        </select>
      </FilterBar>
      <p className="mb-3 text-sm text-muted">{submittedCount} submitted · {filtered.length - submittedCount} not submitted</p>
      <ErrorNote className="mb-3" message={query.isError ? "Could not load submissions." : ""} />
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Form</th>
              <th>Exhibition</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Fields</th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => {
              const watched = fieldId ? row.fields.find((field) => field.id === fieldId) : undefined;
              return (
                <tr key={row.id ?? row.vendor.id}>
                  <td>
                    <Link className="font-medium underline" href={row.id ? `/admin/reviews/${row.id}` : `/admin/vendors/${row.vendor.id}`}>{row.vendor.companyName}</Link>
                    <p className="truncate text-xs font-normal text-muted sm:max-w-xs" title={`${row.vendor.contactName} · ${row.vendor.email}`}>{row.vendor.contactName} · {row.vendor.email}</p>
                  </td>
                  <td data-label="Form">{row.form ? `${row.form.name} v${row.form.versionNumber}` : "No form"}</td>
                  <td data-label="Exhibition">{row.exhibition?.name ?? "—"}</td>
                  <td data-label="Status"><StatusBadge status={row.status} /></td>
                  <td data-label="Submitted">{row.submittedAt ? formatDate(row.submittedAt) : "—"}</td>
                  <td data-label="Fields" data-stack>
                    {row.fieldCount === 0 ? <span className="text-muted">—</span> : (
                      <details>
                        <summary className="cursor-pointer py-0.5 text-sm">{row.filledCount} of {row.fieldCount} filled{watched ? ` · ${watched.filled ? "this field is filled" : "this field is empty"}` : ""}</summary>
                        <ul className="mt-2 grid gap-1.5">
                          {row.fields.map((field) => (
                            <li key={field.id} className="flex items-center justify-between gap-3 text-xs">
                              <span className={`min-w-0 ${field.id === fieldId ? "font-semibold" : ""}`}>{field.label}</span>
                              <Badge tone={field.filled ? "success" : "neutral"}>{field.filled ? "Filled" : "Empty"}</Badge>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager page={page.page} pageCount={page.pageCount} total={page.total} rangeStart={page.rangeStart} rangeEnd={page.rangeEnd} onPage={page.setPage} />
      {query.isLoading ? <LoadingState label="Loading submissions…" description="Gathering company answers." /> : null}
      {!query.isLoading && !query.isError && page.total === 0 ? <p className="text-sm text-muted sm:mt-3">No vendors match this search.</p> : null}
    </div>
  );
}
