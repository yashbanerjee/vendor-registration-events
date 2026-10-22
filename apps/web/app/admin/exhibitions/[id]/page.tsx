"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Check, ChevronLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Badge, EmptyState, ErrorNote, PageHeader, StatusBadge, inputClass } from "@/components/ui";

type FieldFill = { id: string; label: string; filled: boolean; required: boolean };
type FormProgress = {
  id: string;
  status: string;
  submittedAt: string | null;
  form: { name: string; versionNumber: number };
  fields: FieldFill[];
  filledCount: number;
  fieldCount: number;
  requiredFilled: number;
  requiredCount: number;
};
type VendorProgress = {
  id: string;
  reference: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  status: string;
  category: string;
  forms: FormProgress[];
};
type ExhibitionDetail = {
  data: {
    id: string;
    name: string;
    code: string;
    venue: string;
    description: string;
    startsAt: string;
    endsAt: string;
    status: string;
    vendors: VendorProgress[];
  };
};

type Filter = "all" | "complete" | "partial" | "open";

function activeForms(vendor: VendorProgress) {
  const active = vendor.forms.filter((form) => form.status !== "REVOKED");
  return active.length ? active : vendor.forms;
}

function vendorState(vendor: VendorProgress): Exclude<Filter, "all"> {
  const forms = activeForms(vendor).filter((form) => form.fieldCount > 0);
  if (!forms.length) return "open";
  const filled = forms.reduce((sum, form) => sum + form.filledCount, 0);
  const total = forms.reduce((sum, form) => sum + form.fieldCount, 0);
  if (filled === 0) return "open";
  if (filled === total) return "complete";
  return "partial";
}

function percent(filled: number, total: number) {
  if (!total) return 0;
  return Math.round((filled / total) * 100);
}

export default function ExhibitionDetailPage() {
  const params = useParams<{ id: string }>().id;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const query = useQuery({
    queryKey: ["exhibition", params],
    queryFn: () => api<ExhibitionDetail>(`/exhibitions/${params}`),
    enabled: Boolean(params),
  });
  const exhibition = query.data?.data;
  const vendors = exhibition?.vendors ?? [];
  const totals = useMemo(() => {
    let filled = 0;
    let total = 0;
    let requiredOpen = 0;
    let complete = 0;
    let partial = 0;
    let open = 0;
    for (const vendor of vendors) {
      const state = vendorState(vendor);
      if (state === "complete") complete += 1;
      else if (state === "partial") partial += 1;
      else open += 1;
      for (const form of activeForms(vendor)) {
        filled += form.filledCount;
        total += form.fieldCount;
        requiredOpen += form.requiredCount - form.requiredFilled;
      }
    }
    return { filled, total, requiredOpen, complete, partial, open, percent: percent(filled, total) };
  }, [vendors]);
  const visible = vendors.filter((vendor) => {
    const haystack = `${vendor.companyName} ${vendor.contactName} ${vendor.email} ${vendor.reference} ${vendor.category}`.toLowerCase();
    if (q.trim() && !haystack.includes(q.trim().toLowerCase())) return false;
    if (filter !== "all" && vendorState(vendor) !== filter) return false;
    return true;
  });

  return (
    <div>
      <Link href="/admin/exhibitions" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft size={16} aria-hidden />
        Exhibitions
      </Link>
      <ErrorNote message={query.isError ? "Could not load this exhibition." : ""} />
      {query.isLoading ? <p className="text-sm text-muted">Loading vendors…</p> : null}
      {exhibition ? (
        <>
          <section className="mb-4 overflow-hidden rounded-lg border border-border bg-surface">
            <div className="h-1.5 bg-brand" />
            <div className="p-5">
              <PageHeader
                title={exhibition.name}
                description={exhibition.description || "Vendor progress for this exhibition."}
                actions={<StatusBadge status={exhibition.status} />}
              />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <span className="font-medium uppercase tracking-wide">{exhibition.code}</span>
                {exhibition.venue ? <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden />{exhibition.venue}</span> : null}
                <span className="inline-flex items-center gap-1"><CalendarRange size={14} aria-hidden />{formatDate(exhibition.startsAt)} – {formatDate(exhibition.endsAt)}</span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Overall" value={`${totals.percent}%`} hint={totals.requiredOpen ? `${totals.filled} of ${totals.total} fields done · ${totals.requiredOpen} required left` : `${totals.filled} of ${totals.total} fields done`} />
                <Stat label="Complete" value={String(totals.complete)} hint="Every field filled in" />
                <Stat label="In progress" value={String(totals.partial)} hint="Some fields still open" />
                <Stat label="Not started" value={String(totals.open)} hint="No answers yet" />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={totals.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Overall field progress">
                <div className="h-full rounded-full bg-brand" style={{ width: `${totals.percent}%` }} />
              </div>
            </div>
          </section>

          <div className="mb-4 flex flex-wrap gap-2">
            <input className={`${inputClass} max-w-sm`} placeholder="Search company, contact, or email" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Search vendors" />
            <FilterButton current={filter} value="all" onSelect={setFilter}>All ({vendors.length})</FilterButton>
            <FilterButton current={filter} value="complete" onSelect={setFilter}>Complete</FilterButton>
            <FilterButton current={filter} value="partial" onSelect={setFilter}>In progress</FilterButton>
            <FilterButton current={filter} value="open" onSelect={setFilter}>Not started</FilterButton>
          </div>

          {vendors.length === 0 ? <EmptyState title="No vendors yet" body="Assign vendors to this exhibition and their form progress will show up here." /> : null}
          {vendors.length > 0 && visible.length === 0 ? <p className="text-sm text-muted">No vendors match this search.</p> : null}
          <div className="grid gap-3">
            {visible.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

function FilterButton({ current, value, onSelect, children }: { current: Filter; value: Filter; onSelect: (value: Filter) => void; children: React.ReactNode }) {
  const selected = current === value;
  return (
    <button type="button" aria-pressed={selected} className={`h-9 rounded-md border px-3 text-sm font-semibold ${selected ? "border-brand bg-brand text-[var(--brand-foreground)]" : "border-border bg-surface hover:bg-secondary"}`} onClick={() => onSelect(value)}>
      {children}
    </button>
  );
}

function VendorCard({ vendor }: { vendor: VendorProgress }) {
  const forms = activeForms(vendor);
  const filled = forms.reduce((sum, form) => sum + form.filledCount, 0);
  const total = forms.reduce((sum, form) => sum + form.fieldCount, 0);
  const done = percent(filled, total);
  const initial = vendor.companyName.trim().charAt(0).toUpperCase() || "V";
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--badge-info-bg)] text-base font-semibold text-brand" aria-hidden>
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link className="text-base font-semibold hover:underline" href={`/admin/vendors/${vendor.id}`}>{vendor.companyName}</Link>
            <StatusBadge status={vendor.status} />
            {vendor.category ? <Badge tone="neutral">{vendor.category}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted">{[vendor.contactName, vendor.email, vendor.phone].filter(Boolean).join(" · ")}</p>
          <p className="text-xs text-muted">{vendor.reference}</p>
        </div>
        <div className="min-w-36 flex-1 sm:max-w-xs">
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">{total ? `${filled} of ${total} done` : "No fields"}</span>
            <span className="text-muted">{done}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={100} aria-label={`${vendor.companyName} field progress`}>
            <div className={`h-full rounded-full ${done === 100 ? "bg-[var(--success)]" : "bg-brand"}`} style={{ width: `${done}%` }} />
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-4">
        {forms.length === 0 ? <p className="text-sm text-muted">No form is assigned, so there is nothing to complete yet.</p> : null}
        {forms.map((form) => (
          <FormBlock key={form.id} form={form} />
        ))}
      </div>
    </article>
  );
}

function FormBlock({ form }: { form: FormProgress }) {
  const done = form.fields.filter((field) => field.filled);
  const remaining = form.fields.filter((field) => !field.filled);
  const share = percent(form.filledCount, form.fieldCount);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{form.form.name} v{form.form.versionNumber}</h3>
        <StatusBadge status={form.status} />
        <Link className="text-sm text-brand underline" href={`/admin/reviews/${form.id}`}>Open submission</Link>
        <span className="text-xs text-muted">{share}% · {form.requiredFilled} of {form.requiredCount} required</span>
      </div>
      {form.fieldCount === 0 ? <p className="text-sm text-muted">This form has no answer fields.</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          <FieldColumn title="Done" count={done.length} fields={done} tone="success" empty="Nothing filled in yet." />
          <FieldColumn title="Remaining" count={remaining.length} fields={remaining} tone="warning" empty="Every field is filled in." markRequired />
        </div>
      )}
    </div>
  );
}

function FieldColumn({ title, count, fields, tone, empty, markRequired }: { title: string; count: number; fields: FieldFill[]; tone: "success" | "warning"; empty: string; markRequired?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? fields : fields.slice(0, 8);
  return (
    <div className={`rounded-md border border-border px-3 py-3 ${tone === "success" ? "bg-[var(--badge-success-bg)]" : "bg-[var(--badge-warning-bg)]"}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title} · {count}</p>
      {fields.length === 0 ? <p className="text-sm text-muted">{empty}</p> : (
        <ul className="flex flex-wrap gap-1.5">
          {visible.map((field) => (
            <li key={field.id} className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-xs font-medium shadow-[0_0_0_1px_var(--border)]">
              {tone === "success" ? <Check size={12} className="text-[var(--success)]" aria-hidden /> : null}
              {field.label}
              {markRequired && field.required ? <span className="text-[var(--danger)]">Required</span> : null}
            </li>
          ))}
        </ul>
      )}
      {fields.length > 8 ? (
        <button type="button" className="mt-2 text-xs font-semibold text-brand" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Show fewer" : `Show ${fields.length - 8} more`}
        </button>
      ) : null}
    </div>
  );
}
