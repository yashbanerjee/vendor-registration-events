"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { COUNTRIES, isFieldVisible, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { FileLink } from "@/components/file-preview";
import { Button, EmptyState, Notice, PageHeader, StatusBadge } from "@/components/ui";

type Assignment = {
  id: string;
  status: string;
  deadline: string | null;
  submittedAt: string | null;
  vendor: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string | null;
    category: string | null;
    reference: string;
  };
  form: { name: string; schema: FormSchemaDefinition };
  exhibition: { name: string; venue: string | null; startsAt: string | null; endsAt: string | null };
  values: Record<string, unknown>;
};

export default function VendorHomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading dashboard…</p>}>
      <VendorDashboard />
    </Suspense>
  );
}

function VendorDashboard() {
  const submitted = useSearchParams().get("submitted") === "1";
  const query = useQuery({ queryKey: ["my-assignments"], queryFn: () => api<{ data: Assignment[] }>("/assignments") });
  const rows = query.data?.data ?? [];
  const profile = rows[0]?.vendor;
  return (
    <div className="grid gap-4">
      <PageHeader title="Dashboard" description="Your company profile and the answers on each exhibition form." />
      <Notice message={submitted ? "Your form was submitted. The answers are below." : ""} />
      {query.isLoading ? <p className="text-sm text-muted">Loading dashboard…</p> : null}
      {rows.length === 0 && !query.isLoading ? <EmptyState title="No forms yet" body="When an organizer assigns a form, it will appear here." /> : null}
      {profile ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-base font-semibold">{profile.companyName}</h2>
          <p className="mt-1 text-sm text-muted">{profile.reference}</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Detail label="Contact" value={profile.contactName} />
            <Detail label="Email" value={profile.email} />
            <Detail label="Phone" value={profile.phone || "Not provided"} />
            <Detail label="Category" value={profile.category || "Not provided"} />
          </dl>
        </section>
      ) : null}
      {rows.map((row) => (
        <FormSummary key={row.id} row={row} />
      ))}
    </div>
  );
}

function FormSummary({ row }: { row: Assignment }) {
  const editable = row.status === "INVITED" || row.status === "IN_PROGRESS" || row.status === "CORRECTION_REQUESTED";
  const schema = row.form.schema;
  const byId = new Map(schema.fields.map((field) => [field.id, field]));
  const sections = [...schema.sections].sort((a, b) => a.order - b.order);
  const when = [row.exhibition.startsAt ? formatDate(row.exhibition.startsAt) : "", row.exhibition.endsAt ? formatDate(row.exhibition.endsAt) : ""].filter(Boolean).join(" – ");
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{row.form.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {row.exhibition.name}
            {row.exhibition.venue ? ` · ${row.exhibition.venue}` : ""}
            {when ? ` · ${when}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted">
            Due {formatDate(row.deadline)}
            {row.submittedAt ? ` · Submitted ${formatDate(row.submittedAt)}` : ""}
          </p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <div className="mt-4 grid gap-4">
        {sections.map((section) => {
          const fields = schema.fields
            .filter((field) => field.sectionId === section.id)
            .sort((a, b) => a.order - b.order)
            .filter((field) => isFieldVisible(field, row.values, byId));
          if (!fields.length) return null;
          return (
            <div key={section.id}>
              <h3 className="text-sm font-semibold">{section.title}</h3>
              {section.description ? <p className="mt-1 text-xs text-muted">{section.description}</p> : null}
              <dl className="mt-2 divide-y divide-border rounded-md border border-border">
                {fields.map((field) =>
                  field.type === "heading" || field.type === "info" ? (
                    <div key={field.id} className="bg-secondary px-3 py-2 text-sm">
                      <p className="font-medium">{field.label}</p>
                      {field.description ? <p className="text-xs text-muted">{field.description}</p> : null}
                    </div>
                  ) : (
                    <div key={field.id} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(10rem,16rem)_1fr] sm:gap-4">
                      <dt className="text-sm text-muted">{field.label}</dt>
                      <dd className="whitespace-pre-wrap text-sm">{field.type === "file" || field.type === "image" || field.type === "files" ? <FileAnswers value={row.values[field.id]} /> : displayValue(field, row.values[field.id])}</dd>
                    </div>
                  ),
                )}
              </dl>
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <Button asChild variant={editable ? "primary" : "secondary"}>
          <Link href={`/vendor/assignments/${row.id}`}>{editable ? "Continue form" : "Open form"}</Link>
        </Button>
      </div>
    </section>
  );
}

function FileAnswers({ value }: { value: unknown }) {
  const files = fileAnswers(value);
  if (!files.length) return <span className="text-muted">Not answered</span>;
  return (
    <span className="grid gap-1">
      {files.map((file) => (file.documentId ? <FileLink key={file.documentId} documentId={file.documentId} filename={file.filename} /> : <span key={file.filename}>{file.filename}</span>))}
    </span>
  );
}

function fileAnswers(value: unknown): { documentId: string; filename: string }[] {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { documentId?: unknown; filename?: unknown };
    const filename = typeof record.filename === "string" && record.filename ? record.filename : "";
    if (!filename) return [];
    return [{ documentId: typeof record.documentId === "string" ? record.documentId : "", filename }];
  });
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function displayValue(field: FormField, value: unknown): string {
  if (field.type === "toggle") return value ? "Yes" : "No";
  if (isBlank(value)) return "Not answered";
  if (field.type === "country") {
    const code = String(value);
    return COUNTRIES.find((country) => country.code === code)?.name ?? code;
  }
  if (field.type === "select" || field.type === "radio") {
    return field.options?.find((option) => option.value === String(value))?.label ?? String(value);
  }
  if (field.type === "multiselect" || field.type === "checkbox") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    if (!selected.length) return "Not answered";
    return selected.map((item) => field.options?.find((option) => option.value === item)?.label ?? item).join(", ");
  }
  if (field.type === "file" || field.type === "image" || field.type === "files") {
    const names = (Array.isArray(value) ? value : [value]).map(fileName).filter(Boolean);
    return names.length ? names.join(", ") : "Not answered";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value.map((item) => (typeof item === "string" || typeof item === "number" ? String(item) : fileName(item))).filter(Boolean);
    return parts.length ? parts.join(", ") : "Not answered";
  }
  return fileName(value) || "Not answered";
}

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function fileName(value: unknown): string {
  if (value && typeof value === "object" && "filename" in value) return String((value as { filename?: string }).filename ?? "");
  return "";
}
