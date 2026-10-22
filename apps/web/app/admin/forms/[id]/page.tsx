"use client";

import { FIELD_TYPES, type FieldType, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { arrayMove } from "@dnd-kit/sortable";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { FormRenderer } from "@/components/form-renderer";
import { RemoteFileLink } from "@/components/file-preview";
import { ApiError, api } from "@/lib/api";
import { Button, ErrorNote, Field, Notice, PageHeader, UploadStatus, UploadTick, inputClass } from "@/components/ui";

type Template = {
  data: {
    id: string;
    name: string;
    description: string;
    scope: "GLOBAL" | "EXHIBITION" | "VENDOR";
    draftSchema: FormSchemaDefinition;
    versions: { id: string; versionNumber: number }[];
  };
};

const palette = FIELD_TYPES.filter((type) => type !== "repeater");

export default function FormBuilderPage() {
  const params = useParams<{ id: string }>();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["form", params.id], queryFn: () => api<Template>(`/forms/${params.id}`) });
  const [schema, setSchema] = useState<FormSchemaDefinition | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.data) {
      setSchema(query.data.data.draftSchema);
      setName(query.data.data.name);
    }
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => api(`/forms/${params.id}/draft`, { method: "PUT", body: JSON.stringify({ name, schema, scope: query.data?.data.scope ?? "GLOBAL" }) }),
    onSuccess: async () => { setMessage("Draft saved."); setError(""); await client.invalidateQueries({ queryKey: ["form", params.id] }); },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Save failed."),
  });
  const publish = useMutation({
    mutationFn: async () => {
      await api(`/forms/${params.id}/draft`, { method: "PUT", body: JSON.stringify({ name, schema, scope: query.data?.data.scope ?? "GLOBAL" }) });
      return api(`/forms/${params.id}/publish`, { method: "POST" });
    },
    onSuccess: async () => { setMessage("Published a new immutable version."); setError(""); await client.invalidateQueries({ queryKey: ["form", params.id] }); },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Publish failed."),
  });

  if (!schema) return <p className="text-sm text-muted">Loading form…</p>;
  const sectionId = schema.sections[0]?.id;
  const field = schema.fields.find((item) => item.id === selected) ?? null;

  function addField(type: FieldType) {
    if (!sectionId) return;
    const id = crypto.randomUUID();
    const next: FormField = {
      id,
      key: `${type}_${schema!.fields.length + 1}`,
      type,
      label: labelFor(type),
      description: "",
      required: false,
      placeholder: "",
      options: ["select", "multiselect", "radio", "checkbox"].includes(type) ? [{ value: "option_1", label: "Option 1" }] : [],
      validation: {},
      sectionId,
      order: schema!.fields.length,
      conditional: null,
      readOnly: type === "info",
      children: [],
    };
    setSchema({ ...schema!, fields: [...schema!.fields, next] });
    setSelected(id);
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setSchema({ ...schema!, fields: schema!.fields.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  }

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-8.25rem)] lg:min-h-0 lg:overflow-hidden">
      <div className="shrink-0">
        <PageHeader
          title={name || "Form"}
          description={`This canvas is the form vendors will fill in. Click a field to edit it. Published versions: ${query.data?.data.versions.map((version) => `v${version.versionNumber}`).join(", ") || "none yet"}`}
          actions={
            <div className="flex gap-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>Save draft</Button>
              <Button variant="primary" onClick={() => publish.mutate()} disabled={publish.isPending}>Publish</Button>
            </div>
          }
        />
        <ErrorNote message={error} />
        <Notice message={message} />
        <Field label="Form name">
          <input className={`${inputClass} max-w-md`} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
      </div>
      <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[200px_minmax(0,1fr)_minmax(240px,320px)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
        <aside className="max-h-72 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-surface p-3 lg:h-full lg:max-h-full">
          <h2 className="mb-2 text-xs font-semibold uppercase text-muted">Add a field</h2>
          <div className="grid gap-1">
            {palette.map((type) => (
              <button key={type} className="rounded border border-border px-2 py-1 text-left text-sm hover:bg-secondary" onClick={() => addField(type)}>
                {labelFor(type)}
              </button>
            ))}
          </div>
        </aside>
        <div className="min-h-0 min-w-0 lg:h-full lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1">
          {schema.fields.length === 0 ? <p className="mb-3 text-sm text-muted">Add a field. It appears here the same way a vendor will see it.</p> : null}
          <FormRenderer
            schema={schema}
            values={values}
            selectedFieldId={selected}
            onSelectField={setSelected}
            onChange={(fieldId, value) => {
              setSelected(fieldId);
              setValues((current) => ({ ...current, [fieldId]: value }));
            }}
            onUpload={async (_field, file) => ({ documentId: "preview", filename: file.name })}
          />
        </div>
        <aside className="flex max-h-[calc(100dvh-8.25rem)] min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-surface lg:h-full lg:max-h-full">
          <h2 className="shrink-0 px-3 pt-3 text-xs font-semibold uppercase text-muted">Configuration</h2>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
            {!field ? <p className="text-sm text-muted">Select a field in the form.</p> : (
              <div className="grid min-w-0 gap-3 break-words">
                <Field label="Label"><input className={inputClass} value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} /></Field>
                <Field label="Internal key"><input className={inputClass} value={field.key} onChange={(event) => updateField(field.id, { key: event.target.value })} /></Field>
                <Field label="Help text"><input className={inputClass} value={field.description ?? ""} onChange={(event) => updateField(field.id, { description: event.target.value })} /></Field>
                {field.type === "reupload" ? (
                  <TemplateFile templateId={params.id} field={field} onChange={(template) => updateField(field.id, { template })} />
                ) : (
                  <Field label="Placeholder"><input className={inputClass} value={field.placeholder ?? ""} onChange={(event) => updateField(field.id, { placeholder: event.target.value })} /></Field>
                )}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })} /> Compulsory</label>
                <p className="text-xs text-muted">A compulsory field must be filled before the vendor can submit.</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => move(field.id, -1)}>Move up</Button>
                  <Button size="sm" onClick={() => move(field.id, 1)}>Move down</Button>
                </div>
                <Button size="sm" variant="danger" onClick={() => { setSchema({ ...schema, fields: schema.fields.filter((item) => item.id !== field.id) }); setSelected(null); }}>Remove</Button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );

  function move(id: string, direction: number) {
    const index = schema!.fields.findIndex((item) => item.id === id);
    const target = index + direction;
    if (target < 0 || target >= schema!.fields.length) return;
    const moved = arrayMove(schema!.fields, index, target).map((item, order) => ({ ...item, order }));
    setSchema({ ...schema!, fields: moved });
  }
}

function labelFor(type: FieldType) {
  if (type === "reupload") return "Download & reupload";
  return type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function TemplateFile({ templateId, field, onChange }: { templateId: string; field: FormField; onChange: (template: { assetId: string; filename: string }) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPending(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const result = await api<{ data: { id: string; filename: string } }>(`/forms/${templateId}/assets`, { method: "POST", body });
      onChange({ assetId: result.data.id, filename: result.data.filename });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The file could not be uploaded.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-2">
      <p className="text-xs font-semibold uppercase text-muted">File for vendors</p>
      <p className="text-xs text-muted">Vendors download this file, then upload their completed copy.</p>
      {field.template?.assetId && field.template.filename ? (
        <div className="flex min-w-0 items-start gap-2 break-all [&_button]:whitespace-normal [&_button]:text-left">
          <span className="mt-0.5"><UploadTick /></span>
          <RemoteFileLink path={`/form-assets/${field.template.assetId}/content`} filename={field.template.filename} />
        </div>
      ) : (
        <p className="text-sm text-muted">No file uploaded yet.</p>
      )}
      <label className={`inline-flex h-9 w-fit max-w-full items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-secondary ${pending ? "cursor-wait opacity-70" : "cursor-pointer"}`}>
        <input className="sr-only" type="file" disabled={pending} onChange={(event) => void pick(event)} />
        {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
        {pending ? "Uploading…" : "Choose file"}
      </label>
      <UploadStatus pending={pending} />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
