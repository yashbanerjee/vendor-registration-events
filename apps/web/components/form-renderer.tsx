"use client";

import { Lock } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { COUNTRIES, isFieldVisible, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { FileLink, RemoteFileLink } from "./file-preview";
import { isEditable } from "@/lib/locking";
import { vendorErrorMessage } from "@/lib/errors";
import { UploadStatus, UploadTick } from "@/components/ui";
import { cn } from "@/lib/utils";

type Upload = (field: FormField, file: File) => Promise<{ documentId: string; filename: string }>;

/**
 * Draws a form the way the parent registration site does: a centered section title with the
 * copper-to-blue rule, then a two-column grid of floating-label fields, choice pills, and dashed upload rows.
 * `bare` leaves out the panel around each section, for a host that already supplies the card.
 */
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
  selectedSectionId,
  onSelectSection,
  idPrefix,
  visibleSectionId,
  documentTable,
  bare,
}: {
  schema: FormSchemaDefinition;
  values: Record<string, unknown>;
  onChange?: (fieldId: string, value: unknown) => void;
  editableFieldIds?: string[];
  notes?: { fieldId: string; note: string }[];
  errors?: { fieldId: string; message: string }[];
  disabled?: boolean;
  onUpload?: Upload;
  selectedFieldId?: string | null;
  onSelectField?: (fieldId: string) => void;
  selectedSectionId?: string | null;
  onSelectSection?: (sectionId: string) => void;
  idPrefix?: string;
  visibleSectionId?: string | null;
  documentTable?: boolean;
  bare?: boolean;
}) {
  const byId = new Map(schema.fields.map((field) => [field.id, field]));
  const sections = [...schema.sections].sort((a, b) => a.order - b.order).filter((section) => !visibleSectionId || section.id === visibleSectionId);
  return (
    <div className={cn("grid min-w-0 grid-cols-1", bare ? "" : "gap-4")}>
      {sections.map((section) => {
        const visible = schema.fields
          .filter((field) => field.sectionId === section.id)
          .sort((a, b) => a.order - b.order)
          .filter((field) => isFieldVisible(field, values, byId));
        const groups = groupFields(visible, Boolean(documentTable), section.title);
        const hasRequired = visible.some((field) => field.required);
        const showMandatoryLegend = hasRequired && !/mandatory/i.test(section.description || "");
        const sectionSelected = selectedSectionId === section.id && !selectedFieldId;
        return (
          <section key={section.id} className={bare ? "min-w-0" : "panel min-w-0 px-4 pb-6 sm:px-6 sm:pb-8"}>
            <h2
              className={cn(
                "brand-title",
                onSelectSection ? "cursor-pointer rounded-md outline-offset-4" : "",
                onSelectSection && sectionSelected ? "outline outline-2 outline-[var(--brand)]" : "",
                onSelectSection && !sectionSelected ? "hover:outline hover:outline-1 hover:outline-[var(--field-border)]" : "",
              )}
              onClick={(event) => {
                if (!onSelectSection) return;
                event.stopPropagation();
                onSelectSection(section.id);
              }}
            >
              {section.title}
            </h2>
            {section.description ? <p className="brand-lead">{section.description}</p> : null}
            {showMandatoryLegend ? (
              <p className={cn("brand-legend", section.description ? "mt-3" : "")}>Fields marked with <span className="req">*</span> are mandatory.</p>
            ) : (
              <div className="mb-8" />
            )}
            <div className="form-fields">
              <div className="form-grid">
                {groups.map((group) => group.table ? (
                  <div key={group.fields[0]?.id} className="is-wide min-w-0">
                    <DocumentTable
                      fields={group.fields}
                      values={values}
                      notes={notes}
                      errors={errors}
                      disabled={disabled}
                      editableFieldIds={editableFieldIds}
                      idPrefix={idPrefix}
                      selectedFieldId={selectedFieldId}
                      onSelectField={onSelectField}
                      onChange={onChange}
                      onUpload={onUpload}
                    />
                  </div>
                ) : group.fields.map((field) => (
                  <div
                    key={field.id}
                    onClick={() => onSelectField?.(field.id)}
                    className={cn(
                      "min-w-0",
                      isWide(field) ? "is-wide" : "",
                      onSelectField ? "cursor-pointer rounded-md outline-offset-[6px]" : "",
                      onSelectField ? (selectedFieldId === field.id ? "outline outline-2 outline-[var(--brand)]" : "hover:outline hover:outline-1 hover:outline-[var(--field-border)]") : "",
                    )}
                  >
                    <FieldControl id={`${idPrefix ? `${idPrefix}-` : ""}${field.id}`} field={field} value={values[field.id]} note={notes?.find((item) => item.fieldId === field.id)?.note} error={errors?.find((item) => item.fieldId === field.id)?.message} editable={isEditable(field.id, editableFieldIds, disabled)} onChange={onChange} onUpload={onUpload} />
                  </div>
                )))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function groupFields(fields: FormField[], table: boolean, sectionTitle: string) {
  const documentCards = table && /order|additional/i.test(sectionTitle);
  const groups: { table: boolean; fields: FormField[] }[] = [];
  for (const field of fields) {
    const useTable = documentCards && isDocumentField(field);
    const last = groups.at(-1);
    if (last && last.table && useTable) last.fields.push(field);
    else groups.push({ table: useTable, fields: [field] });
  }
  return groups;
}

/** Order / Additional packs use boxed "Document required" cards for reupload fields. */
function isDocumentField(field: FormField) {
  return field.type === "reupload";
}

/** The line under an upload row: which files are accepted and how large they may be. */
function fileHint(field: FormField) {
  const formats = field.file?.accept?.map((item) => item.replace(/^\./, "").replace(/^.*\//, "").toUpperCase()).filter(Boolean) ?? [];
  const base = field.type === "image" ? "Images only" : formats.length ? `Accepted formats: ${formats.join(", ")}` : field.type === "files" ? "Add one or more files" : "PDF or image";
  const megabytes = field.file?.maxSizeBytes ? Math.max(1, Math.round(field.file.maxSizeBytes / 1_000_000)) : 0;
  return megabytes ? `${base} – max. ${megabytes} MB` : base;
}

// A floating label is one line inside the box. A longer question goes above its field instead, so it can wrap.
const FLOATING_LABEL_MAX = 56;

/** Text-like fields and dropdowns that take the floating-label box. */
function isBoxField(field: FormField) {
  return !["heading", "info", "radio", "multiselect", "checkbox", "toggle", "file", "image", "files", "reupload"].includes(field.type);
}

function isFloating(field: FormField) {
  return isBoxField(field) && field.label.length <= FLOATING_LABEL_MAX;
}

/** Half-width fields sit two to a row. Everything else takes the whole row. */
function isWide(field: FormField) {
  return field.type === "textarea" || !isFloating(field);
}

function RequiredMark({ field }: { field: FormField }) {
  return field.required ? <span className="req"> *</span> : null;
}

function LockedTag() {
  return <span className="ml-2 whitespace-nowrap text-xs font-medium text-dim">Locked</span>;
}

function DocumentTable({
  fields,
  values,
  notes,
  errors,
  disabled,
  editableFieldIds,
  idPrefix,
  selectedFieldId,
  onSelectField,
  onChange,
  onUpload,
}: {
  fields: FormField[];
  values: Record<string, unknown>;
  notes?: { fieldId: string; note: string }[];
  errors?: { fieldId: string; message: string }[];
  disabled?: boolean;
  editableFieldIds?: string[];
  idPrefix?: string;
  selectedFieldId?: string | null;
  onSelectField?: (fieldId: string) => void;
  onChange?: (fieldId: string, value: unknown) => void;
  onUpload?: Upload;
}) {
  // grid-cols-1 is minmax(0, 1fr): a long file name must truncate, not widen the card past the screen.
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      {fields.map((field) => {
        const id = `${idPrefix ? `${idPrefix}-` : ""}${field.id}`;
        const note = notes?.find((item) => item.fieldId === field.id)?.note;
        const error = errors?.find((item) => item.fieldId === field.id)?.message;
        const editable = isEditable(field.id, editableFieldIds, disabled);
        const uploaded = fileItems(values[field.id]).length > 0;
        const describedBy = [note ? `${id}-note` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
        const template = field.type === "reupload" ? field.template : undefined;
        return (
          <article
            key={field.id}
            id={id}
            onClick={() => onSelectField?.(field.id)}
            className={cn(
              "brand-note",
              error ? "brand-note--danger" : note ? "brand-note--copper" : "",
              selectedFieldId === field.id ? "outline outline-2 outline-offset-2 outline-[var(--brand)]" : "",
            )}
          >
            <p className="eyebrow">{field.required ? "Document required" : "Optional"}</p>
            <h3 className="mt-1.5 break-words text-base font-semibold leading-6 text-[var(--heading)]">
              {field.label}
              <RequiredMark field={field} />
              {!editable ? <LockedTag /> : null}
            </h3>

            {field.description ? <p className="form-help">{field.description}</p> : null}

            {template?.assetId && template.filename ? (
              <div className="mt-3 min-w-0 rounded-md border border-border bg-[var(--tint)] px-3 py-2.5">
                <p className="eyebrow">Template</p>
                <div className="mt-1 min-w-0">
                  <RemoteFileLink path={`/form-assets/${template.assetId}/content`} filename={template.filename} />
                </div>
              </div>
            ) : null}

            {error ? <p id={`${id}-error`} className="form-error mt-3">{error}</p> : null}
            {note ? <p id={`${id}-note`} className="form-correction mt-3">Correction: {note}</p> : null}

            <div className="mt-4">
              <FileField
                id={`${id}-upload`}
                field={field}
                value={values[field.id]}
                editable={editable}
                describedBy={describedBy}
                uploaded={uploaded}
                onChange={(next) => onChange?.(field.id, next)}
                onUpload={onUpload}
              />
            </div>
          </article>
        );
      })}
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
  hideLabel = false,
  onChange,
  onUpload,
}: {
  id: string;
  field: FormField;
  value: unknown;
  note?: string;
  error?: string;
  editable: boolean;
  hideLabel?: boolean;
  onChange?: (fieldId: string, value: unknown) => void;
  onUpload?: Upload;
}) {
  if (field.type === "heading") return <h3 className="form-subhead">{field.label}</h3>;
  if (field.type === "info") return <UndertakingCopy text={field.description || field.label} />;

  const describedBy = [field.description ? `${id}-help` : "", note ? `${id}-note` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const change = (next: unknown) => onChange?.(field.id, next);
  const state = { invalid: Boolean(error), flagged: Boolean(note) };
  const footer = (
    <>
      {field.description ? <p id={`${id}-help`} className="form-help">{field.description}</p> : null}
      {error ? <p id={`${id}-error`} className="form-error">{error}</p> : null}
      {note ? <p id={`${id}-note`} className="form-correction">Correction: {note}</p> : null}
    </>
  );

  if (isFloating(field)) {
    return (
      <>
        <BoxControl id={id} field={field} value={value} editable={editable} describedBy={describedBy} floating onChange={change} {...state} />
        {footer}
      </>
    );
  }

  if (isBoxField(field)) {
    return (
      <>
        {hideLabel ? null : (
          <label htmlFor={id} className="field-label field-label--tight">
            {field.label}
            <RequiredMark field={field} />
            {!editable ? <LockedTag /> : null}
          </label>
        )}
        <BoxControl id={id} field={field} value={value} editable={editable} describedBy={describedBy} onChange={change} {...state} />
        {footer}
      </>
    );
  }

  const isFile = field.type === "file" || field.type === "image" || field.type === "files" || field.type === "reupload";
  const heading = (
    <>
      {field.label}
      <RequiredMark field={field} />
      {!editable ? <LockedTag /> : null}
    </>
  );

  if (isFile) {
    const template = field.type === "reupload" ? field.template : undefined;
    return (
      <>
        {hideLabel ? null : <label htmlFor={id} className="field-label field-label--file">{heading}</label>}
        {template?.assetId && template.filename ? (
          <div className="mb-3 min-w-0 rounded-md border border-border bg-[var(--tint)] px-3 py-2.5">
            <p className="eyebrow">Template</p>
            <div className="mt-1 min-w-0">
              <RemoteFileLink path={`/form-assets/${template.assetId}/content`} filename={template.filename} />
            </div>
          </div>
        ) : null}
        <FileField id={id} field={field} value={value} editable={editable} describedBy={describedBy} onChange={change} onUpload={onUpload} />
        {footer}
      </>
    );
  }

  const singleConfirm = field.type === "checkbox" && (field.options?.length ?? 0) <= 1;
  return (
    <>
      {hideLabel || singleConfirm ? null : <span id={`${id}-label`} className="field-label">{heading}</span>}
      <ChoicePills id={id} field={field} value={value} editable={editable} describedBy={describedBy} onChange={change} />
      {footer}
    </>
  );
}

function UndertakingCopy({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="form-info">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <br key={index} />;
        const heading = /^(CONTRACTOR\b|[A-C]\.|IMPORTANT\b|Authorized Representative)/i.test(trimmed);
        return (
          <p key={index} className={heading ? "form-info-heading" : undefined}>
            {line}
          </p>
        );
      })}
    </div>
  );
}

/** Input, text area, or dropdown in the 58px box. With `floating` the label lives inside the box. */
function BoxControl({
  id,
  field,
  value,
  editable,
  describedBy,
  floating,
  invalid,
  flagged,
  onChange,
}: {
  id: string;
  field: FormField;
  value: unknown;
  editable: boolean;
  describedBy?: string;
  floating?: boolean;
  invalid?: boolean;
  flagged?: boolean;
  onChange: (value: unknown) => void;
}) {
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const isSelect = field.type === "select" || field.type === "country";
  const type = field.type === "number" || field.type === "currency" ? "number" : field.type === "datetime" ? "datetime-local" : field.type === "tel" ? "tel" : field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text";
  // Date and time inputs always show their own format hint, so their label stays raised.
  const alwaysRaised = type === "date" || type === "time" || type === "datetime-local";
  const className = cn("ff-control", floating ? "" : "ff-control--plain", invalid ? "is-invalid" : flagged ? "is-flagged" : "");
  const shared = { id, className, disabled: !editable, "aria-describedby": describedBy, "aria-invalid": invalid || undefined };
  // A space keeps the placeholder "shown" state working when the field has no placeholder of its own.
  const placeholder = field.placeholder || (floating ? " " : undefined);

  let control: React.ReactNode;
  if (field.type === "textarea") {
    control = <textarea {...shared} placeholder={placeholder} value={text} onChange={(event) => onChange(event.target.value)} />;
  } else if (isSelect) {
    const options = field.type === "country" ? COUNTRIES.map((country) => ({ value: country.code, label: country.name })) : field.options ?? [];
    control = (
      <select {...shared} value={text} onChange={(event) => onChange(event.target.value)}>
        <option value="">{floating ? "" : "Select"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  } else {
    control = <input {...shared} type={type} placeholder={placeholder} value={text} onChange={(event) => onChange(event.target.value)} />;
  }

  if (!floating) return <div className="ff">{control}</div>;
  return (
    <div className={cn("ff", isSelect ? "ff--select" : "", editable ? "" : "ff--locked")} data-filled={text !== "" || alwaysRaised ? "true" : undefined}>
      {control}
      <label htmlFor={id}>
        {field.label}
        <RequiredMark field={field} />
      </label>
      {!editable ? (
        <span className="ff-lock" title="Locked">
          <Lock size={14} aria-hidden />
          <span className="sr-only">Locked</span>
        </span>
      ) : null}
    </div>
  );
}

/** One choice, several choices, or yes/no, drawn as pills. */
function ChoicePills({
  id,
  field,
  value,
  editable,
  describedBy,
  onChange,
}: {
  id: string;
  field: FormField;
  value: unknown;
  editable: boolean;
  describedBy?: string;
  onChange: (value: unknown) => void;
}) {
  const group = { id, role: "group", "aria-labelledby": `${id}-label`, "aria-describedby": describedBy, className: "pill-group" } as const;
  if (field.type === "toggle") {
    return (
      <div {...group}>
        <button type="button" className="pill pill--yes" disabled={!editable} aria-pressed={value === true} onClick={() => onChange(true)}>Yes</button>
        <button type="button" className="pill pill--no" disabled={!editable} aria-pressed={value === false} onClick={() => onChange(false)}>No</button>
      </div>
    );
  }
  if (field.type === "checkbox") {
    const options = field.options ?? [];
    if (options.length <= 1) {
      const option = options[0];
      const checked = value === true || value === "true" || (Array.isArray(value) && option && value.map(String).includes(option.value));
      return (
        <label className="form-confirm" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={Boolean(checked)}
            disabled={!editable}
            aria-describedby={describedBy}
            onChange={(event) => {
              if (option) onChange(event.target.checked ? [option.value] : []);
              else onChange(event.target.checked);
            }}
          />
          <span>{option?.label || field.label}</span>
        </label>
      );
    }
  }
  if (field.type === "radio") {
    const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
    return (
      <div {...group}>
        {(field.options ?? []).map((option) => (
          <button key={option.value} type="button" className="pill" disabled={!editable} aria-pressed={text === option.value} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    );
  }
  const selected = Array.isArray(value) ? value.map(String) : [];
  return (
    <div {...group}>
      {(field.options ?? []).map((option) => {
        const on = selected.includes(option.value);
        return (
          <button key={option.value} type="button" className="pill" disabled={!editable} aria-pressed={on} onClick={() => onChange(on ? selected.filter((item) => item !== option.value) : [...selected, option.value])}>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Upload row: a dashed box with a "Choose file" button, then the uploaded files in green. */
function FileField({
  id,
  field,
  value,
  editable,
  describedBy,
  uploaded: uploadedHint,
  onChange,
  onUpload,
}: {
  id: string;
  field: FormField;
  value: unknown;
  editable: boolean;
  describedBy?: string;
  uploaded?: boolean;
  onChange: (value: unknown) => void;
  onUpload?: Upload;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [localPreview, setLocalPreview] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const previews = useRef<string[]>([]);
  const files = fileItems(value);
  const multiple = field.type === "files";
  const accept = field.type === "image" ? "image/*" : field.file?.accept?.join(",");
  const hasFiles = files.length > 0 || Boolean(uploadedHint);
  const blocked = !editable || !onUpload || pending;

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
      setError(vendorErrorMessage(caught, "The file could not be uploaded. Please try again."));
    } finally {
      setPending(false);
    }
  }

  const buttonLabel = pending ? "Uploading…" : hasFiles ? (multiple ? "Add file" : "Replace file") : "Choose file";
  const statusText = pending ? "Please wait" : hasFiles ? (files.length > 1 ? `${files.length} files uploaded` : "File uploaded") : "No file chosen";

  return (
    <div className="grid min-w-0 grid-cols-1 gap-1">
      <input
        ref={inputRef}
        id={id}
        className="sr-only"
        type="file"
        accept={accept || undefined}
        disabled={blocked}
        aria-describedby={describedBy}
        onChange={(event) => void pick(event)}
      />
      <button type="button" className="file-drop" disabled={blocked} onClick={() => inputRef.current?.click()}>
        <span className="file-drop-button">{buttonLabel}</span>
        <span className={cn("file-drop-text", hasFiles && !pending ? "text-success" : "")}>{statusText}</span>
      </button>
      <p className="form-help">{fileHint(field)}</p>
      {files.length > 0 ? (
        <ul className="mt-1 grid min-w-0 grid-cols-1 gap-2">
          {files.map((file) => (
            <li key={file.documentId || file.filename} className="file-current grid min-w-0 grid-cols-1 gap-2">
              {localPreview[file.documentId] ? (
                <img src={localPreview[file.documentId]} alt={file.filename} className="max-h-40 w-full rounded-md border border-border bg-white object-contain" />
              ) : null}
              <span className="flex min-w-0 items-center gap-2">
                <UploadTick />
                <span className="min-w-0 flex-1">
                  {file.documentId && isStoredDocument(file.documentId) ? (
                    <FileLink documentId={file.documentId} filename={file.filename} />
                  ) : (
                    <span className="block truncate text-sm font-medium" title={file.filename}>{file.filename}</span>
                  )}
                  <span className="mt-0.5 block text-xs font-medium text-success">Active file</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      <UploadStatus pending={pending} />
    </div>
  );
}

function isStoredDocument(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
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
