"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { COUNTRIES, isFieldVisible, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { FileLink, InlineFilePreview, RemoteFileLink } from "./file-preview";
import { isEditable } from "@/lib/locking";
import { inputClass } from "./ui";

export function FormRenderer({
  schema,
  values,
  onChange,
  editableFieldIds,
  notes,
  errors,
  disabled,
  onUpload,
  selectedFieldId,
  onSelectField,
  idPrefix,
}: {
  schema: FormSchemaDefinition;
  values: Record<string, unknown>;
  onChange?: (fieldId: string, value: unknown) => void;
  editableFieldIds?: string[];
  notes?: { fieldId: string; note: string }[];
  errors?: { fieldId: string; message: string }[];
  disabled?: boolean;
  onUpload?: (field: FormField, file: File) => Promise<{ documentId: string; filename: string }>;
  selectedFieldId?: string | null;
  onSelectField?: (fieldId: string) => void;
  idPrefix?: string;
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
                <div
                  key={field.id}
                  onClick={() => onSelectField?.(field.id)}
                  className={onSelectField ? `rounded-md p-1 ${selectedFieldId === field.id ? "ring-2 ring-brand" : "ring-1 ring-transparent hover:ring-border"}` : undefined}
                >
                  <FieldControl id={`${idPrefix ? `${idPrefix}-` : ""}${field.id}`} field={field} value={values[field.id]} note={notes?.find((item) => item.fieldId === field.id)?.note} error={errors?.find((item) => item.fieldId === field.id)?.message} editable={isEditable(field.id, editableFieldIds, disabled)} onChange={onChange} onUpload={onUpload} />
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FieldControl({
  id,
  field,
  value,
  note,
  error,
  editable,
  onChange,
  onUpload,
}: {
  id: string;
  field: FormField;
  value: unknown;
  note?: string;
  error?: string;
  editable: boolean;
  onChange?: (fieldId: string, value: unknown) => void;
  onUpload?: (field: FormField, file: File) => Promise<{ documentId: string; filename: string }>;
}) {
  if (field.type === "heading") return <h3 className="text-sm font-semibold">{field.label}</h3>;
  if (field.type === "info") return <p className="text-sm text-muted">{field.description || field.label}</p>;
  const describedBy = [note ? `${id}-note` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  if (field.type === "reupload") {
    return (
      <div className={note || error ? "rounded-md border border-[var(--warning)] bg-[var(--badge-warning-bg)] p-3" : ""}>
        <div className="grid gap-1 text-sm">
          <span className="font-medium">
            {field.label}
            {field.required ? <span className="text-danger"> *</span> : null}
            {!editable ? <span className="ml-2 text-xs font-normal text-muted">Locked</span> : null}
          </span>
          {field.description ? <span className="text-xs text-muted">{field.description}</span> : null}
          <ReuploadField id={id} field={field} value={value} editable={editable} describedBy={describedBy} onChange={(next) => onChange?.(field.id, next)} onUpload={onUpload} />
        </div>
        {error ? <p id={`${id}-error`} className="mt-2 text-sm text-danger">{error}</p> : null}
        {note ? <p id={`${id}-note`} className="mt-2 text-sm text-[var(--badge-warning-fg)]">Correction: {note}</p> : null}
      </div>
    );
  }
  return (
    <div className={note || error ? "rounded-md border border-[var(--warning)] bg-[var(--badge-warning-bg)] p-3" : ""}>
      <label className="grid gap-1 text-sm" htmlFor={id}>
        <span className="font-medium">
          {field.label}
          {field.required ? <span className="text-danger"> *</span> : null}
          {!editable ? <span className="ml-2 text-xs font-normal text-muted">Locked</span> : null}
        </span>
        {field.description ? <span className="text-xs text-muted">{field.description}</span> : null}
        <Control id={id} field={field} value={value} editable={editable} describedBy={describedBy} onChange={(next) => onChange?.(field.id, next)} onUpload={onUpload} />
      </label>
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {note ? (
        <p id={`${id}-note`} className="mt-2 text-sm text-[var(--badge-warning-fg)]">
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
    return <FileField id={id} field={field} value={value} editable={editable} describedBy={describedBy} onChange={onChange} onUpload={onUpload} />;
  }
  const type = field.type === "number" || field.type === "currency" ? "number" : field.type === "datetime" ? "datetime-local" : field.type === "tel" ? "tel" : field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text";
  return <input id={id} className={inputClass} type={type} disabled={!editable} aria-describedby={describedBy} placeholder={field.placeholder} value={text} onChange={(event) => onChange(event.target.value)} />;
}

function ReuploadField({
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
  const template = field.template;
  return (
    <div className="grid gap-3">
      <div className="rounded-md border border-border bg-secondary p-3">
        <p className="text-xs font-medium uppercase text-muted">Download this file</p>
        {template?.assetId && template.filename ? (
          <RemoteFileLink path={`/form-assets/${template.assetId}/content`} filename={template.filename} />
        ) : (
          <p className="mt-1 text-sm text-muted">No file has been uploaded yet.</p>
        )}
      </div>
      <div className="grid gap-1">
        <p className="text-xs font-medium uppercase text-muted">Upload your completed file</p>
        <FileField id={id} field={field} value={value} editable={editable} describedBy={describedBy} onChange={onChange} onUpload={onUpload} />
      </div>
    </div>
  );
}

function FileField({
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
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [localPreview, setLocalPreview] = useState<Record<string, string>>({});
  const previews = useRef<string[]>([]);
  const files = fileItems(value);
  const multiple = field.type === "files";
  const accept = field.type === "image" ? "image/*" : field.file?.accept?.join(",");

  useEffect(() => () => {
    for (const url of previews.current) URL.revokeObjectURL(url);
  }, []);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onUpload) return;
    setPending(true);
    setError("");
    try {
      const uploaded = await onUpload(field, file);
      if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
        const url = URL.createObjectURL(file);
        previews.current.push(url);
        setLocalPreview((current) => ({ ...current, [uploaded.documentId]: url }));
      }
      onChange(multiple ? [...files, uploaded] : uploaded);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The file could not be uploaded.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      {files.map((file) =>
        localPreview[file.documentId] ? (
          <img key={file.documentId || file.filename} src={localPreview[file.documentId]} alt={file.filename} className="max-h-48 w-full rounded-md border border-border bg-white object-contain" />
        ) : file.documentId && isStoredDocument(file.documentId) ? (
          isImageName(file.filename) ? (
            <InlineFilePreview key={file.documentId} documentId={file.documentId} filename={file.filename} />
          ) : (
            <FileLink key={file.documentId} documentId={file.documentId} filename={file.filename} />
          )
        ) : (
          <span key={file.filename} className="text-xs text-muted">{file.filename}</span>
        ),
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {pending ? <p className="text-sm text-muted">Uploading…</p> : null}
      {editable ? (
        <input id={id} type="file" accept={accept || undefined} disabled={!onUpload || pending} aria-describedby={describedBy} onChange={(event) => void pick(event)} />
      ) : null}
    </div>
  );
}

function isStoredDocument(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function isImageName(filename: string) {
  return /\.(png|jpe?g|jpe|jfif|gif|webp|bmp|avif|tiff?)$/i.test(filename);
}

function fileItems(value: unknown): { documentId: string; filename: string }[] {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { documentId?: unknown; filename?: unknown };
    const filename = typeof record.filename === "string" ? record.filename : "";
    const documentId = typeof record.documentId === "string" ? record.documentId : "";
    if (!filename && !documentId) return [];
    return [{ documentId, filename: filename || "Uploaded file" }];
  });
}
