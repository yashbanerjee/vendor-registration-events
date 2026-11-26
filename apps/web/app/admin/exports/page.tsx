"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ApiError, api, download } from "@/lib/api";
import { Button, ErrorNote, Field, LoadingState, Notice, PageHeader, inputClass } from "@/components/ui";

type FormOption = {
  id: string;
  name: string;
  status: string;
  versions?: { id: string; versionNumber: number; publishedAt?: string | null }[];
};

type ExportField = { id: string; key: string; label: string; type: string };

export default function ExportsPage() {
  const [formTemplateId, setFormTemplateId] = useState("");
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const forms = useQuery({
    queryKey: ["forms"],
    queryFn: () => api<{ data: FormOption[] }>("/forms"),
  });

  const formOptions = useMemo(
    () =>
      (forms.data?.data ?? [])
        .filter((form) => (form.versions?.length ?? 0) > 0)
        .map((form) => ({
          id: form.id,
          label: form.name,
          versionHint: form.versions?.[0] ? `v${form.versions[0].versionNumber}` : "",
        })),
    [forms.data?.data],
  );

  const fieldsQuery = useQuery({
    queryKey: ["form-export-fields", formTemplateId],
    queryFn: () =>
      api<{ data: { formName: string; versionNumber: number; fields: ExportField[] } }>(
        `/reports/form-export/fields?formTemplateId=${encodeURIComponent(formTemplateId)}`,
      ),
    enabled: Boolean(formTemplateId),
  });

  const fields = fieldsQuery.data?.data.fields ?? [];
  const allSelected = fields.length > 0 && selectedFieldIds.length === fields.length;

  function toggleField(fieldId: string, checked: boolean) {
    setSelectedFieldIds((current) => {
      if (checked) return current.includes(fieldId) ? current : [...current, fieldId];
      return current.filter((id) => id !== fieldId);
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedFieldIds(checked ? fields.map((field) => field.id) : []);
  }

  const exportCsv = useMutation({
    mutationFn: async () => {
      if (!formTemplateId || selectedFieldIds.length === 0) {
        throw new Error("Choose a form and at least one field.");
      }
      const formName = fieldsQuery.data?.data.formName ?? "form";
      const safeName = formName.replace(/[^\w.\- ]+/g, "_").trim().slice(0, 60) || "form";
      await download(
        "/reports/form-export",
        `${safeName}-answers.csv`,
        {
          method: "POST",
          body: JSON.stringify({ formTemplateId, fieldIds: selectedFieldIds }),
        },
      );
    },
    onSuccess: () => {
      setError("");
      setNotice("Export downloaded. Each row is one vendor with the selected form fields.");
    },
    onError: (caught) => {
      setNotice("");
      setError(caught instanceof ApiError || caught instanceof Error ? caught.message : "Could not export the form answers.");
    },
  });

  return (
    <div>
      <PageHeader
        title="Exports"
        description="Choose a form and the fields to include, then download a CSV with one row per vendor."
      />
      <Notice message={notice} />
      <ErrorNote className="mb-3" message={error} />

      {forms.isLoading ? <LoadingState label="Loading forms…" description="Fetching published and draft forms." /> : null}

      <div className="grid max-w-3xl gap-4">
        <Field label="Form" hint="Uses answers from every vendor assigned to this form.">
          <select
            className={inputClass}
            value={formTemplateId}
            onChange={(event) => {
              setFormTemplateId(event.target.value);
              setSelectedFieldIds([]);
              setError("");
              setNotice("");
            }}
          >
            <option value="">Select a form</option>
            {formOptions.map((form) => (
              <option key={form.id} value={form.id}>
                {form.label}{form.versionHint ? ` (${form.versionHint})` : ""}
              </option>
            ))}
          </select>
        </Field>

        {formTemplateId && fieldsQuery.isLoading ? (
          <LoadingState label="Loading fields…" description="Reading the form schema." />
        ) : null}

        {formTemplateId && !fieldsQuery.isLoading ? (
          <div className="grid gap-3 rounded-md border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[var(--heading)]">Fields</h2>
                <p className="text-sm text-muted">
                  {fieldsQuery.data?.data.formName
                    ? `${fieldsQuery.data.data.formName} · v${fieldsQuery.data.data.versionNumber}`
                    : "Select fields to include as columns."}
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={allSelected}
                  disabled={fields.length === 0}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
                Select all
              </label>
            </div>

            {fields.length === 0 ? (
              <p className="text-sm text-muted">This form has no answerable fields to export.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {fields.map((field) => {
                  const checked = selectedFieldIds.includes(field.id);
                  return (
                    <li key={field.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-border hover:bg-secondary">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                          checked={checked}
                          onChange={(event) => toggleField(field.id, event.target.checked)}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{field.label}</span>
                          <span className="block truncate text-xs text-muted">{field.type}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={!formTemplateId || selectedFieldIds.length === 0 || exportCsv.isPending}
            onClick={() => exportCsv.mutate()}
          >
            {exportCsv.isPending ? "Preparing…" : `Download CSV${selectedFieldIds.length ? ` (${selectedFieldIds.length} fields)` : ""}`}
          </Button>
        </div>

        <p className="text-sm text-muted">
          CSV layout: <code className="text-xs">vendor</code>, then each selected field as its own column.
        </p>
      </div>
    </div>
  );
}
