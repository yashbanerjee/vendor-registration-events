"use client";

import { FIELD_TYPES, type FieldType, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { arrayMove } from "@dnd-kit/sortable";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FormRenderer } from "@/components/form-renderer";
import { ApiError, api } from "@/lib/api";
import { Button, ErrorNote, Field, PageHeader, inputClass } from "@/components/ui";

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
    <div>
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
      {message ? <p className="mb-3 text-sm text-success">{message}</p> : null}
      <Field label="Form name">
        <input className={`${inputClass} max-w-md`} value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <aside className="rounded-lg border border-border bg-surface p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase text-muted">Add a field</h2>
          <div className="grid gap-1">
            {palette.map((type) => (
              <button key={type} className="rounded border border-border px-2 py-1 text-left text-sm hover:bg-secondary" onClick={() => addField(type)}>
                {labelFor(type)}
              </button>
            ))}
          </div>
        </aside>
        <div>
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
        <aside className="rounded-lg border border-border bg-surface p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase text-muted">Configuration</h2>
          {!field ? <p className="text-sm text-muted">Select a field in the form.</p> : (
            <div className="grid gap-3">
              <Field label="Label"><input className={inputClass} value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} /></Field>
              <Field label="Internal key"><input className={inputClass} value={field.key} onChange={(event) => updateField(field.id, { key: event.target.value })} /></Field>
              <Field label="Help text"><input className={inputClass} value={field.description ?? ""} onChange={(event) => updateField(field.id, { description: event.target.value })} /></Field>
              <Field label="Placeholder"><input className={inputClass} value={field.placeholder ?? ""} onChange={(event) => updateField(field.id, { placeholder: event.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })} /> Compulsory</label>
              <p className="text-xs text-muted">A compulsory field must be filled before the vendor can submit.</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => move(field.id, -1)}>Move up</Button>
                <Button size="sm" onClick={() => move(field.id, 1)}>Move down</Button>
              </div>
              <Button size="sm" variant="danger" onClick={() => { setSchema({ ...schema, fields: schema.fields.filter((item) => item.id !== field.id) }); setSelected(null); }}>Remove</Button>
            </div>
          )}
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
  return type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
