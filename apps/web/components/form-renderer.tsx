"use client";

import { COUNTRIES, isFieldVisible, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { isEditable } from "@/lib/locking";
import { inputClass } from "./ui";

export function FormRenderer({
  schema,
  values,
  onChange,
  editableFieldIds,
  notes,
  disabled,
  onUpload,
}: {
  schema: FormSchemaDefinition;
  values: Record<string, unknown>;
  onChange?: (fieldId: string, value: unknown) => void;
  editableFieldIds?: string[];
  notes?: { fieldId: string; note: string }[];
  disabled?: boolean;
  onUpload?: (field: FormField, file: File) => Promise<{ documentId: string; filename: string }>;
}) {
  const byId = new Map(schema.fields.map((field) => [field.id, field]));
  const sections = [...schema.sections].sort((a, b) => a.order - b.order);
  return (
    <div className="grid gap-4">
      {sections.map((section) => (
        <section key={section.id} className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">{section.title}</h2>
          {section.description ? <p className="mb-3 text-sm text-muted">{section.description}</p> : null}
          <div className="grid gap-4">
            {schema.fields
              .filter((field) => field.sectionId === section.id)
              .sort((a, b) => a.order - b.order)
              .filter((field) => isFieldVisible(field, values, byId))
              .map((field) => (
                <FieldControl key={field.id} field={field} value={values[field.id]} note={notes?.find((item) => item.fieldId === field.id)?.note} editable={isEditable(field.id, editableFieldIds, disabled)} onChange={onChange} onUpload={onUpload} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FieldControl({
  field,
  value,
  note,
  editable,
  onChange,
  onUpload,
}: {
  field: FormField;
  value: unknown;
  note?: string;
  editable: boolean;
  onChange?: (fieldId: string, value: unknown) => void;
  onUpload?: (field: FormField, file: File) => Promise<{ documentId: string; filename: string }>;
}) {
  if (field.type === "heading") return <h3 className="text-sm font-semibold">{field.label}</h3>;
  if (field.type === "info") return <p className="text-sm text-muted">{field.description || field.label}</p>;
  const describedBy = note ? `${field.id}-note` : undefined;
  return (
    <div className={note ? "rounded-md border border-[var(--warning)] bg-[var(--badge-warning-bg)] p-3" : ""}>
      <label className="grid gap-1 text-sm" htmlFor={field.id}>
        <span className="font-medium">
          {field.label}
          {field.required ? <span className="text-danger"> *</span> : null}
          {!editable ? <span className="ml-2 text-xs font-normal text-muted">Locked</span> : null}
        </span>
        {field.description ? <span className="text-xs text-muted">{field.description}</span> : null}
        <Control id={field.id} field={field} value={value} editable={editable} describedBy={describedBy} onChange={(next) => onChange?.(field.id, next)} onUpload={onUpload} />
      </label>
      {note ? (
        <p id={describedBy} className="mt-2 text-sm text-[var(--badge-warning-fg)]">
          Correction: {note}
        </p>
      ) : null}
    </div>
  );
}

function Control({
  id,
  field,
  value,
  editable,
  describedBy,
  onChange,
  onUpload,
}: {
  id: string;
  field: FormField;
  value: unknown;
  editable: boolean;
  describedBy?: string;
  onChange: (value: unknown) => void;
  onUpload?: (field: FormField, file: File) => Promise<{ documentId: string; filename: string }>;
}) {
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  if (field.type === "textarea") {
    return <textarea id={id} className={`${inputClass} min-h-24 py-2`} disabled={!editable} aria-describedby={describedBy} placeholder={field.placeholder} value={text} onChange={(event) => onChange(event.target.value)} />;
  }
  if (field.type === "select" || field.type === "country") {
    const options = field.type === "country" ? COUNTRIES.map((country) => ({ value: country.code, label: country.name })) : field.options ?? [];
    return (
      <select id={id} className={inputClass} disabled={!editable} aria-describedby={describedBy} value={text} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }
  if (field.type === "radio") {
    return (
      <div className="grid gap-1" role="radiogroup" aria-describedby={describedBy}>
        {(field.options ?? []).map((option) => (
          <label key={option.value} className="flex items-center gap-2">
            <input type="radio" name={id} disabled={!editable} checked={text === option.value} onChange={() => onChange(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "multiselect" || field.type === "checkbox") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <div className="grid gap-1">
        {(field.options ?? []).map((option) => (
          <label key={option.value} className="flex items-center gap-2">
            <input
              type="checkbox"
              disabled={!editable}
              checked={selected.includes(option.value)}
              onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value))}
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "toggle") {
    return <input id={id} type="checkbox" disabled={!editable} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />;
  }
  if (field.type === "file" || field.type === "image" || field.type === "files") {
    const current = value && typeof value === "object" && "filename" in (value as object) ? String((value as { filename?: string }).filename ?? "Uploaded file") : "";
    return (
      <div className="grid gap-1">
        {current ? <span className="text-xs text-muted">{current}</span> : null}
        <input
          id={id}
          type="file"
          disabled={!editable || !onUpload}
          aria-describedby={describedBy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file || !onUpload) return;
            const uploaded = await onUpload(field, file);
            onChange(uploaded);
          }}
        />
      </div>
    );
  }
  const type = field.type === "number" || field.type === "currency" ? "number" : field.type === "datetime" ? "datetime-local" : field.type === "tel" ? "tel" : field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text";
  return <input id={id} className={inputClass} type={type} disabled={!editable} aria-describedby={describedBy} placeholder={field.placeholder} value={text} onChange={(event) => onChange(event.target.value)} />;
}
