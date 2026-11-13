"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { COUNTRIES, isFieldVisible, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { FileLink, InlineFilePreview, RemoteFileLink } from "./file-preview";
import { isEditable } from "@/lib/locking";
import { friendlyErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UploadStatus, UploadTick, inputClass, textareaClass } from "@/components/ui";
import { cn } from "@/lib/utils";

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
  visibleSectionId,
  documentTable,
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
  visibleSectionId?: string | null;
  documentTable?: boolean;
}) {
  const byId = new Map(schema.fields.map((field) => [field.id, field]));
  const sections = [...schema.sections].sort((a, b) => a.order - b.order).filter((section) => !visibleSectionId || section.id === visibleSectionId);
  return (
    <div className="grid gap-4">
      {sections.map((section) => {
        const visible = schema.fields
          .filter((field) => field.sectionId === section.id)
          .sort((a, b) => a.order - b.order)
          .filter((field) => isFieldVisible(field, values, byId));
        const groups = groupFields(visible, Boolean(documentTable));
        return (
          <Card key={section.id} className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              {section.description ? <CardDescription>{section.description}</CardDescription> : null}
            </CardHeader>
            <CardContent className="grid gap-3">
              {groups.map((group) => group.table ? (
                <DocumentTable
                  key={group.fields[0]?.id}
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
              ) : group.fields.map((field) => (
                <div
                  key={field.id}
                  onClick={() => onSelectField?.(field.id)}
                  className={onSelectField ? `min-w-0 rounded-md p-1 ${selectedFieldId === field.id ? "ring-2 ring-brand" : "ring-1 ring-transparent hover:ring-border"}` : "min-w-0"}
                >
                  <FieldControl id={`${idPrefix ? `${idPrefix}-` : ""}${field.id}`} field={field} value={values[field.id]} note={notes?.find((item) => item.fieldId === field.id)?.note} error={errors?.find((item) => item.fieldId === field.id)?.message} editable={isEditable(field.id, editableFieldIds, disabled)} onChange={onChange} onUpload={onUpload} />
                </div>
              )))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function groupFields(fields: FormField[], table: boolean) {
  const groups: { table: boolean; fields: FormField[] }[] = [];
  for (const field of fields) {
    const useTable = table && isDocumentField(field);
    const last = groups.at(-1);
    if (last && last.table && useTable) last.fields.push(field);
    else groups.push({ table: useTable, fields: [field] });
  }
  return groups;
}

function isDocumentField(field: FormField) {
  return field.type === "reupload" || field.type === "file" || field.type === "files";
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
  onUpload?: (field: FormField, file: File) => Promise<{ documentId: string; filename: string }>;
}) {
  return (
    <div className="table-wrap overflow-hidden rounded-md border border-border bg-surface">
      <Table className="documents table-fixed">
        <TableHeader className="bg-secondary">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[26%]">Document required</TableHead>
            <TableHead className="w-[28%]">Note</TableHead>
            <TableHead className="w-[23%]">Document template</TableHead>
            <TableHead className="w-[23%]">Upload document</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field) => {
            const id = `${idPrefix ? `${idPrefix}-` : ""}${field.id}`;
            const note = notes?.find((item) => item.fieldId === field.id)?.note;
            const error = errors?.find((item) => item.fieldId === field.id)?.message;
            const editable = isEditable(field.id, editableFieldIds, disabled);
            const uploaded = fileItems(values[field.id]).length > 0;
            const describedBy = [note ? `${id}-note` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
            const template = field.type === "reupload" ? field.template : undefined;
            return (
              <TableRow
                key={field.id}
                onClick={() => onSelectField?.(field.id)}
                data-state={error || note ? "attention" : uploaded ? "uploaded" : undefined}
                className={cn(error || note ? "bg-[var(--badge-warning-bg)] hover:bg-[var(--badge-warning-bg)]" : uploaded ? "bg-[var(--badge-success-bg)] hover:bg-[var(--badge-success-bg)]" : "")}
              >
                <TableCell className="align-top" data-label="Document required">
                  <span className={cn("block min-w-0 break-words text-sm font-medium", selectedFieldId === field.id ? "underline" : "")}>
                    {field.label}
                    {field.required ? <span className="text-danger"> *</span> : null}
                  </span>
                  {!editable ? <span className="mt-1 block text-xs text-muted">Locked</span> : null}
                </TableCell>
                <TableCell className="align-top" data-label="Note">
                  <p className="min-w-0 break-words text-sm text-muted">{field.description || "—"}</p>
                  {error ? <p id={`${id}-error`} className="mt-1 break-words text-sm text-danger">{error}</p> : null}
                  {note ? <p id={`${id}-note`} className="mt-1 break-words text-sm text-[var(--badge-warning-fg)]">Correction: {note}</p> : null}
                </TableCell>
                <TableCell className="max-w-0 align-top" data-label="Document template">
                  {template?.assetId && template.filename ? (
                    <div className="min-w-0 max-w-full">
                      <RemoteFileLink path={`/form-assets/${template.assetId}/content`} filename={template.filename} />
                    </div>
                  ) : (
                    <span className="text-sm text-muted">—</span>
                  )}
                </TableCell>
                <TableCell className="max-w-0 align-top" data-label="Upload document">
                  <div className="min-w-0 max-w-full">
                    <FileField id={id} field={field} value={values[field.id]} editable={editable} describedBy={describedBy} dense onChange={(next) => onChange?.(field.id, next)} onUpload={onUpload} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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
  if (field.type === "heading") return <h3 className="px-3 text-sm font-semibold leading-6">{field.label}</h3>;
  if (field.type === "info") return <p className="px-3 text-sm leading-5 text-muted">{field.description || field.label}</p>;
  const describedBy = [note ? `${id}-note` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const shell = note || error
    ? "rounded-md border border-[var(--warning)] bg-[var(--badge-warning-bg)] px-3 py-3"
    : "rounded-md border border-transparent px-3 py-3";
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-medium leading-5">
          {field.label}
          {field.required ? <span className="text-danger"> *</span> : null}
        </span>
        {!editable ? <span className="shrink-0 text-xs font-medium leading-5 text-muted">Locked</span> : null}
      </span>
      {field.description ? <span className="text-sm leading-5 text-muted">{field.description}</span> : null}
    </>
  );
  if (field.type === "reupload") {
    return (
      <div className={shell}>
        <div className="grid gap-1.5 text-sm">
          {body}
          <ReuploadField id={id} field={field} value={value} editable={editable} describedBy={describedBy} onChange={(next) => onChange?.(field.id, next)} onUpload={onUpload} />
        </div>
        {error ? <p id={`${id}-error`} className="mt-2 text-sm leading-5 text-danger">{error}</p> : null}
        {note ? <p id={`${id}-note`} className="mt-2 text-sm leading-5 text-[var(--badge-warning-fg)]">Correction: {note}</p> : null}
      </div>
    );
  }
  return (
    <div className={shell}>
      <label className="grid gap-1.5 text-sm" htmlFor={id}>
        {body}
        <Control id={id} field={field} value={value} editable={editable} describedBy={describedBy} onChange={(next) => onChange?.(field.id, next)} onUpload={onUpload} />
      </label>
      {error ? <p id={`${id}-error`} className="mt-2 text-sm leading-5 text-danger">{error}</p> : null}
      {note ? <p id={`${id}-note`} className="mt-2 text-sm leading-5 text-[var(--badge-warning-fg)]">Correction: {note}</p> : null}
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
    return <textarea id={id} className={textareaClass} disabled={!editable} aria-describedby={describedBy} placeholder={field.placeholder} value={text} onChange={(event) => onChange(event.target.value)} />;
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
          <label key={option.value} className="flex min-h-10 items-center gap-2.5 leading-5">
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
          <label key={option.value} className="flex min-h-10 items-center gap-2.5 leading-5">
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
    return (
      <span className="flex min-h-10 items-center">
        <input id={id} type="checkbox" disabled={!editable} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
      </span>
    );
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
    <div className="grid min-w-0 gap-3">
      <div className="min-w-0 break-all rounded-md border border-border bg-secondary p-3 [&_button]:whitespace-normal [&_button]:text-left">
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
  dense,
  onChange,
  onUpload,
}: {
  id: string;
  field: FormField;
  value: unknown;
  editable: boolean;
  describedBy?: string;
  dense?: boolean;
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
      setError(friendlyErrorMessage(caught, "The file could not be uploaded. Please try again."));
    } finally {
      setPending(false);
    }
  }

  const chooseLabel = pending ? "Uploading…" : files.length ? (multiple ? "Add another" : "Replace") : "Upload";
  return (
    <div className="grid min-w-0 max-w-full gap-2">
      {dense ? (
        files.length ? (
          <span className="inline-flex w-fit max-w-full items-center gap-1.5 text-sm font-semibold text-[var(--badge-success-fg)]">
            <UploadTick />
            Uploaded
          </span>
        ) : (
          <span className="text-sm text-muted">Not uploaded</span>
        )
      ) : null}
      {files.map((file) => (
        <div key={file.documentId || file.filename} className="flex min-w-0 max-w-full items-start gap-2">
          {dense ? null : <span className="mt-1 shrink-0"><UploadTick /></span>}
          <div className="min-w-0 max-w-full flex-1 overflow-hidden">
            {dense ? (
              file.documentId && isStoredDocument(file.documentId) ? (
                <FileLink documentId={file.documentId} filename={file.filename} />
              ) : (
                <span className="block truncate text-sm" title={file.filename}>{file.filename}</span>
              )
            ) : localPreview[file.documentId] ? (
              <img src={localPreview[file.documentId]} alt={file.filename} className="max-h-48 w-full rounded-md border border-border bg-white object-contain" />
            ) : file.documentId && isStoredDocument(file.documentId) ? (
              isImageName(file.filename) ? (
                <InlineFilePreview documentId={file.documentId} filename={file.filename} />
              ) : (
                <FileLink documentId={file.documentId} filename={file.filename} />
              )
            ) : (
              <span className="block truncate text-xs text-muted" title={file.filename}>{file.filename}</span>
            )}
          </div>
        </div>
      ))}
      {error ? <p className="break-words text-sm text-danger">{error}</p> : null}
      {dense ? null : <UploadStatus pending={pending} />}
      {editable ? (
        dense ? (
          <Button asChild size="sm" variant="outline" className={cn("h-11 w-full sm:h-8 sm:w-auto", pending || !onUpload ? "pointer-events-none opacity-70" : "")}>
            <label className="cursor-pointer">
              <input id={id} className="sr-only" type="file" accept={accept || undefined} disabled={!onUpload || pending} aria-describedby={describedBy} onChange={(event) => void pick(event)} />
              {chooseLabel}
            </label>
          </Button>
        ) : (
          <div className="min-w-0 max-w-full overflow-hidden">
            <input id={id} className="block w-full max-w-full text-sm" type="file" accept={accept || undefined} disabled={!onUpload || pending} aria-describedby={describedBy} onChange={(event) => void pick(event)} />
          </div>
        )
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
