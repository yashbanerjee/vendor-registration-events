"use client";

import { DISPLAY_ONLY_TYPES, FIELD_TYPES, type FieldType, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { arrayMove } from "@dnd-kit/sortable";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent } from "react";
import { FormRenderer } from "@/components/form-renderer";
import { RemoteFileLink } from "@/components/file-preview";
import { ApiError, api } from "@/lib/api";
import { Button, ErrorNote, Field, LoadingState, Modal, ModalActions, PageHeader, Spinner, UploadStatus, UploadTick, inputClass } from "@/components/ui";

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

type Section = FormSchemaDefinition["sections"][number];

const palette = FIELD_TYPES.filter((type) => type !== "repeater");

// Side panels: pinned under the 3.5rem top bar with a 1rem gap above and below.
const PINNED = "lg:sticky lg:top-4 lg:max-h-[calc(100dvh-5.5rem)]";

export default function FormBuilderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const [removing, setRemoving] = useState(false);
  const query = useQuery({ queryKey: ["form", params.id], queryFn: () => api<Template>(`/forms/${params.id}`) });
  const [schema, setSchema] = useState<FormSchemaDefinition | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.data) {
      setSchema(query.data.data.draftSchema);
      setName(query.data.data.name);
      setSelectedSectionId(query.data.data.draftSchema.sections[0]?.id ?? null);
    }
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => api(`/forms/${params.id}/draft`, { method: "PUT", body: JSON.stringify({ name, schema, scope: query.data?.data.scope ?? "GLOBAL" }) }),
    onSuccess: async () => {
      setError("");
      await client.invalidateQueries({ queryKey: ["forms"] });
      router.push("/admin/forms");
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Save failed."),
  });
  const publish = useMutation({
    mutationFn: async () => {
      await api(`/forms/${params.id}/draft`, { method: "PUT", body: JSON.stringify({ name, schema, scope: query.data?.data.scope ?? "GLOBAL" }) });
      return api(`/forms/${params.id}/publish`, { method: "POST" });
    },
    onSuccess: async () => {
      setError("");
      await client.invalidateQueries({ queryKey: ["forms"] });
      router.push("/admin/forms");
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Publish failed."),
  });
  const remove = useMutation({
    mutationFn: () => api("/forms/archive", { method: "POST", body: JSON.stringify({ ids: [params.id] }) }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["forms"] });
      router.push("/admin/forms");
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not delete the form."),
  });

  if (query.isError) return <p className="text-sm text-muted">This form was not found.</p>;
  if (!schema) return <LoadingState label="Loading form…" description="Opening the form builder." />;

  const sections = [...schema.sections].sort((a, b) => a.order - b.order);
  const activeSectionId = selectedSectionId && sections.some((section) => section.id === selectedSectionId)
    ? selectedSectionId
    : sections[0]?.id ?? null;
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? null;
  const field = schema.fields.find((item) => item.id === selected) ?? null;
  const displayOnly = field ? DISPLAY_ONLY_TYPES.includes(field.type) : false;
  const configuringSection = Boolean(activeSection) && !field;

  function selectField(fieldId: string) {
    setSelected(fieldId);
    const next = schema!.fields.find((item) => item.id === fieldId);
    if (next) setSelectedSectionId(next.sectionId);
  }

  function selectSection(sectionId: string) {
    setSelectedSectionId(sectionId);
    setSelected(null);
  }

  function addSection() {
    const id = crypto.randomUUID();
    const next: Section = {
      id,
      title: `Section ${schema!.sections.length + 1}`,
      description: "",
      order: schema!.sections.length,
    };
    setSchema({ ...schema!, sections: [...schema!.sections, next] });
    setSelectedSectionId(id);
    setSelected(null);
  }

  function updateSection(id: string, patch: Partial<Pick<Section, "title" | "description">>) {
    setSchema({
      ...schema!,
      sections: schema!.sections.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    });
  }

  function moveSection(id: string, direction: number) {
    const ordered = [...schema!.sections].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((section) => section.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const moved = arrayMove(ordered, index, target).map((section, order) => ({ ...section, order }));
    setSchema({ ...schema!, sections: moved });
  }

  function removeSection(id: string) {
    if (schema!.sections.length <= 1) {
      setError("A form needs at least one section heading.");
      return;
    }
    const remaining = schema!.sections
      .filter((section) => section.id !== id)
      .sort((a, b) => a.order - b.order)
      .map((section, order) => ({ ...section, order }));
    const fallbackId = remaining[0]?.id;
    setSchema({
      ...schema!,
      sections: remaining,
      fields: schema!.fields
        .filter((item) => item.sectionId !== id)
        .map((item, order) => ({ ...item, order })),
    });
    setSelected(null);
    setSelectedSectionId(fallbackId ?? null);
    setError("");
  }

  function addField(type: FieldType) {
    if (!activeSectionId) return;
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
      sectionId: activeSectionId,
      order: schema!.fields.length,
      conditional: null,
      readOnly: type === "info",
      children: [],
    };
    setSchema({ ...schema!, fields: [...schema!.fields, next] });
    setSelected(id);
    setSelectedSectionId(activeSectionId);
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setSchema({ ...schema!, fields: schema!.fields.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  }

  function moveField(id: string, direction: number) {
    const current = schema!.fields.find((item) => item.id === id);
    if (!current) return;
    const sectionFields = schema!.fields
      .filter((item) => item.sectionId === current.sectionId)
      .sort((a, b) => a.order - b.order);
    const index = sectionFields.findIndex((item) => item.id === id);
    const target = index + direction;
    if (target < 0 || target >= sectionFields.length) return;
    const reordered = arrayMove(sectionFields, index, target);
    const orderById = new Map(reordered.map((item, order) => [item.id, order]));
    const others = schema!.fields.filter((item) => item.sectionId !== current.sectionId);
    const nextFields = [
      ...others,
      ...reordered.map((item, order) => ({ ...item, order })),
    ].sort((a, b) => {
      const sectionOrder = (sectionId: string) => schema!.sections.find((section) => section.id === sectionId)?.order ?? 0;
      const sectionDiff = sectionOrder(a.sectionId) - sectionOrder(b.sectionId);
      if (sectionDiff !== 0) return sectionDiff;
      return (orderById.get(a.id) ?? a.order) - (orderById.get(b.id) ?? b.order);
    }).map((item, order) => ({ ...item, order }));
    setSchema({ ...schema!, fields: nextFields });
  }

  return (
    <div>
      <PageHeader
        title={name || "Form"}
        description={`This canvas is the form vendors will fill in. Click a section heading or field to edit it. Published versions: ${query.data?.data.versions.map((version) => `v${version.versionNumber}`).join(", ") || "none yet"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => { setError(""); setRemoving(true); }}>Delete</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save draft</Button>
            <Button variant="primary" onClick={() => publish.mutate()} disabled={publish.isPending}>Publish</Button>
          </div>
        }
      />
      <ErrorNote className="mb-3" message={error} />
      <Field label="Form name">
        <input className={`${inputClass} sm:max-w-md`} value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      {/* The page scrolls as one; on desktop the two side panels stay pinned beside the canvas. */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[200px_minmax(0,1fr)_minmax(240px,320px)]">
        <aside className={`panel max-h-[min(70dvh,36rem)] min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain p-3 ${PINNED}`}>
          <div className="mb-4 grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="eyebrow">Sections</h2>
              <Button size="sm" onClick={addSection}>Add</Button>
            </div>
            <div className="grid gap-1">
              {sections.map((section) => {
                const active = section.id === activeSectionId;
                const count = schema.fields.filter((item) => item.sectionId === section.id).length;
                return (
                  <button
                    key={section.id}
                    type="button"
                    className={`rounded border px-2 py-1.5 text-left text-sm ${active ? "border-[var(--brand)] bg-secondary" : "border-border hover:bg-secondary"}`}
                    onClick={() => selectSection(section.id)}
                  >
                    <span className="block truncate font-medium">{section.title || "Untitled section"}</span>
                    <span className="text-xs text-muted">{count} field{count === 1 ? "" : "s"}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <h2 className="eyebrow mb-2">Add a field</h2>
          <p className="mb-2 text-xs text-muted">New fields go into the selected section.</p>
          <div className="flex flex-wrap gap-1.5 lg:grid lg:gap-1">
            {palette.map((type) => (
              <button key={type} className="rounded-full border border-border px-3 py-1.5 text-left text-sm hover:bg-secondary lg:rounded lg:px-2 lg:py-1" onClick={() => addField(type)}>
                {labelFor(type)}
              </button>
            ))}
          </div>
        </aside>
        <div className="min-w-0">
          {schema.fields.length === 0 ? <p className="mb-3 text-sm text-muted">Add a field or edit a section heading. It appears here the same way a vendor will see it.</p> : null}
          <FormRenderer
            schema={schema}
            values={values}
            selectedFieldId={selected}
            onSelectField={selectField}
            selectedSectionId={activeSectionId}
            onSelectSection={selectSection}
            onChange={(fieldId, value) => {
              selectField(fieldId);
              setValues((current) => ({ ...current, [fieldId]: value }));
            }}
            onUpload={async (_field, file) => ({ documentId: "preview", filename: file.name })}
          />
        </div>
        <aside className={`panel flex min-h-0 min-w-0 flex-col overflow-hidden overscroll-contain ${PINNED}`}>
          <h2 className="eyebrow shrink-0 px-3 pt-3">Configuration</h2>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-3">
            {configuringSection && activeSection ? (
              <div className="grid min-w-0 gap-3 break-words">
                <p className="text-xs text-muted">Section heading shown to vendors.</p>
                <Field label="Heading">
                  <input
                    className={inputClass}
                    value={activeSection.title}
                    onChange={(event) => updateSection(activeSection.id, { title: event.target.value })}
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    className={`${inputClass} min-h-24`}
                    value={activeSection.description ?? ""}
                    onChange={(event) => updateSection(activeSection.id, { description: event.target.value })}
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => moveSection(activeSection.id, -1)}>Move up</Button>
                  <Button size="sm" onClick={() => moveSection(activeSection.id, 1)}>Move down</Button>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => removeSection(activeSection.id)}
                  disabled={schema.sections.length <= 1}
                >
                  Delete section
                </Button>
                {schema.sections.length <= 1 ? (
                  <p className="text-xs text-muted">Keep at least one section heading on the form.</p>
                ) : (
                  <p className="text-xs text-muted">Deleting a section also removes the fields inside it.</p>
                )}
              </div>
            ) : !field ? (
              <p className="text-sm text-muted">Select a section heading or field in the form.</p>
            ) : (
              <div className="grid min-w-0 gap-3 break-words">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">{labelFor(field.type)}</p>
                <Field label="Label"><input className={inputClass} value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} /></Field>
                <Field label="Internal key"><input className={inputClass} value={field.key} onChange={(event) => updateField(field.id, { key: event.target.value })} /></Field>
                <Field label={field.type === "info" ? "Content" : "Help text"}>
                  {field.type === "info" || field.type === "heading" ? (
                    <textarea
                      className={`${inputClass} min-h-28`}
                      value={field.description ?? ""}
                      onChange={(event) => updateField(field.id, { description: event.target.value })}
                    />
                  ) : (
                    <input className={inputClass} value={field.description ?? ""} onChange={(event) => updateField(field.id, { description: event.target.value })} />
                  )}
                </Field>
                <Field label="Section">
                  <select
                    className={inputClass}
                    value={field.sectionId}
                    onChange={(event) => {
                      updateField(field.id, { sectionId: event.target.value });
                      setSelectedSectionId(event.target.value);
                    }}
                  >
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>{section.title || "Untitled section"}</option>
                    ))}
                  </select>
                </Field>
                {field.type === "reupload" ? (
                  <TemplateFile templateId={params.id} field={field} onChange={(template) => updateField(field.id, { template })} />
                ) : displayOnly ? null : (
                  <Field label="Placeholder"><input className={inputClass} value={field.placeholder ?? ""} onChange={(event) => updateField(field.id, { placeholder: event.target.value })} /></Field>
                )}
                {displayOnly ? null : (
                  <>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })} /> Compulsory</label>
                    <p className="text-xs text-muted">A compulsory field must be filled before the vendor can submit.</p>
                  </>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => moveField(field.id, -1)}>Move up</Button>
                  <Button size="sm" onClick={() => moveField(field.id, 1)}>Move down</Button>
                </div>
                <Button size="sm" variant="danger" onClick={() => { setSchema({ ...schema, fields: schema.fields.filter((item) => item.id !== field.id).map((item, order) => ({ ...item, order })) }); setSelected(null); }}>Remove</Button>
              </div>
            )}
          </div>
        </aside>
      </div>
      <Modal open={removing} title="Delete form" onClose={() => setRemoving(false)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); remove.mutate(); }}>
          <p className="text-sm">Delete {name || "this form"}? It leaves the forms list and cannot be assigned again. Answers already sent stay on record. A company that has not sent it yet will no longer see it.</p>
          <ModalActions>
            <Button type="button" onClick={() => setRemoving(false)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={remove.isPending}>Delete</Button>
          </ModalActions>
        </form>
      </Modal>
    </div>
  );
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
      <label className={`inline-flex h-10 w-fit max-w-full items-center gap-2 rounded-md border border-border px-3 text-sm leading-5 hover:bg-secondary ${pending ? "cursor-wait opacity-70" : "cursor-pointer"}`}>
        <input className="sr-only" type="file" disabled={pending} onChange={(event) => void pick(event)} />
        {pending ? <Spinner size="sm" /> : null}
        {pending ? "Uploading…" : "Choose file"}
      </label>
      <UploadStatus pending={pending} />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
