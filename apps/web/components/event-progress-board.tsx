"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge, EmptyState, StatusBadge, inputClass } from "@/components/ui";

export type FieldFill = { id: string; label: string; filled: boolean; required: boolean };
export type FormProgress = {
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
export type VendorProgress = {
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

type Filter = "all" | "complete" | "partial" | "open" | "none";

function activeForms(vendor: VendorProgress) {
  const active = vendor.forms.filter((form) => form.status !== "REVOKED");
  return active.length ? active : vendor.forms;
}

function vendorState(vendor: VendorProgress): Exclude<Filter, "all"> {
  const forms = activeForms(vendor).filter((form) => form.fieldCount > 0);
  if (!forms.length) return "none";
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

export function EventProgressBoard({ vendors }: { vendors: VendorProgress[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const totals = useMemo(() => {
    let filled = 0;
    let total = 0;
    let requiredOpen = 0;
    let complete = 0;
    let partial = 0;
    let open = 0;
    let none = 0;
    for (const vendor of vendors) {
      const state = vendorState(vendor);
      if (state === "complete") complete += 1;
      else if (state === "partial") partial += 1;
      else if (state === "none") none += 1;
      else open += 1;
      for (const form of activeForms(vendor)) {
        filled += form.filledCount;
        total += form.fieldCount;
        requiredOpen += Math.max(0, form.requiredCount - form.requiredFilled);
      }
    }
    return { filled, total, requiredOpen, complete, partial, open, none, percent: percent(filled, total) };
  }, [vendors]);

  const visible = vendors.filter((vendor) => {
    const haystack = `${vendor.companyName} ${vendor.contactName} ${vendor.email} ${vendor.reference} ${vendor.category}`.toLowerCase();
    if (q.trim() && !haystack.includes(q.trim().toLowerCase())) return false;
    if (filter !== "all" && vendorState(vendor) !== filter) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Fields done"
          value={`${totals.percent}%`}
          hint={
            totals.requiredOpen
              ? `${totals.filled} of ${totals.total} · ${totals.requiredOpen} required left`
              : `${totals.filled} of ${totals.total} fields`
          }
        />
        <Stat label="Complete" value={String(totals.complete)} hint="Every questionnaire field filled" />
        <Stat label="In progress" value={String(totals.partial)} hint="Some fields still open" />
        <Stat label="Not started" value={String(totals.open)} hint="No answers yet" />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <input
          className={`${inputClass} w-full max-w-sm`}
          placeholder="Search company, contact, or email"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          aria-label="Search companies"
        />
        <div className="flex flex-wrap gap-2">
          <FilterButton current={filter} value="all" onSelect={setFilter}>
            All ({vendors.length})
          </FilterButton>
          <FilterButton current={filter} value="complete" onSelect={setFilter}>
            Complete
          </FilterButton>
          <FilterButton current={filter} value="partial" onSelect={setFilter}>
            In progress
          </FilterButton>
          <FilterButton current={filter} value="open" onSelect={setFilter}>
            Not started
          </FilterButton>
          <FilterButton current={filter} value="none" onSelect={setFilter}>
            No questionnaire
          </FilterButton>
        </div>
      </div>

      {vendors.length === 0 ? <EmptyState title="No companies yet" body="Add a company, then assign them this event’s form." /> : null}
      {vendors.length > 0 && visible.length === 0 ? <p className="text-sm text-muted">No companies match this search.</p> : null}

      <div className="grid gap-3">
        {visible.map((vendor) => (
          <VendorCard key={vendor.id} vendor={vendor} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{hint}</p>
    </div>
  );
}

function FilterButton({
  current,
  value,
  onSelect,
  children,
}: {
  current: Filter;
  value: Filter;
  onSelect: (value: Filter) => void;
  children: React.ReactNode;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "h-8 rounded-full px-3 text-sm font-medium transition",
        selected ? "bg-foreground text-[var(--surface)]" : "bg-surface text-muted ring-1 ring-border hover:text-foreground",
      )}
      onClick={() => onSelect(value)}
    >
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
  const categories = vendor.category
    ? vendor.category
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-start gap-4 border-b border-border px-5 py-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-sm font-semibold" aria-hidden>
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link className="text-base font-semibold hover:underline" href={`/admin/vendors/${vendor.id}`}>
              {vendor.companyName}
            </Link>
            <StatusBadge status={vendor.status} />
            {categories.map((category) => (
              <Badge key={category} tone="neutral">
                {category}
              </Badge>
            ))}
          </div>
          <p className="mt-1 text-sm text-muted">{[vendor.contactName, vendor.email, vendor.phone].filter(Boolean).join(" · ")}</p>
          <p className="text-xs text-muted">{vendor.reference}</p>
        </div>
        <div className="min-w-[9rem] flex-1 sm:max-w-xs">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">{total ? `${filled} of ${total} done` : "No fields"}</span>
            <span className="text-muted">{done}%</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${vendor.companyName} field progress`}
          >
            <div className={cn("h-full rounded-full", done === 100 ? "bg-[var(--success)]" : "bg-brand")} style={{ width: `${done}%` }} />
          </div>
        </div>
      </div>
      <div className="grid gap-5 p-5">
        {forms.length === 0 ? <p className="text-sm text-muted">No questionnaire is assigned.</p> : null}
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
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">
          {form.form.name} v{form.form.versionNumber}
        </h3>
        <StatusBadge status={form.status} />
        <Link className="text-sm font-medium text-brand hover:underline" href={`/admin/reviews/${form.id}`}>
          Open submission
        </Link>
      </div>
      {form.fieldCount === 0 ? (
        <p className="text-sm text-muted">This form has no answer fields.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <FieldColumn title="Done" count={done.length} fields={done} tone="success" empty="Nothing filled in yet." />
          <FieldColumn title="Remaining" count={remaining.length} fields={remaining} tone="danger" empty="Every field is filled in." markRequired />
        </div>
      )}
    </div>
  );
}

function FieldColumn({
  title,
  count,
  fields,
  tone,
  empty,
  markRequired,
}: {
  title: string;
  count: number;
  fields: FieldFill[];
  tone: "success" | "danger";
  empty: string;
  markRequired?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const limit = 8;
  const visible = expanded ? fields : fields.slice(0, limit);
  const success = tone === "success";
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-4",
        success
          ? "border-[color-mix(in_srgb,var(--success)_30%,var(--border))] bg-[var(--badge-success-bg)]/55"
          : "border-[color-mix(in_srgb,var(--danger)_30%,var(--border))] bg-[var(--badge-danger-bg)]/70",
      )}
    >
      <p className={cn("mb-3 text-[11px] font-semibold uppercase tracking-[0.14em]", success ? "text-[var(--success)]" : "text-[var(--danger)]")}>
        {title} · {count}
      </p>
      {fields.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {visible.map((field) => (
            <li
              key={field.id}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1 text-xs font-medium",
                success
                  ? "border-[color-mix(in_srgb,var(--success)_40%,transparent)] text-[var(--badge-success-fg)]"
                  : "border-[color-mix(in_srgb,var(--danger)_45%,transparent)] text-foreground",
              )}
            >
              {success ? <Check size={12} className="shrink-0 text-[var(--success)]" aria-hidden /> : null}
              <span className="truncate">{field.label}</span>
              {markRequired && field.required ? <span className="shrink-0 font-semibold text-[var(--danger)]">Required</span> : null}
            </li>
          ))}
        </ul>
      )}
      {fields.length > limit ? (
        <button type="button" className="mt-2 text-xs font-semibold text-brand" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Show fewer" : `Show ${fields.length - limit} more`}
        </button>
      ) : null}
    </div>
  );
}
