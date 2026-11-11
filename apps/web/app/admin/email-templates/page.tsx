"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Badge, Button, ErrorNote, Field, Notice, PageHeader, inputClass, textareaClass } from "@/components/ui";

type EmailTemplate = {
  key: string;
  label: string;
  description: string;
  audience: "vendor" | "admin";
  subject: string;
  title: string;
  body: string;
  actionLabel: string;
  customized: boolean;
  variables: { key: string; label: string }[];
};

type TemplateCopy = {
  subject: string;
  title: string;
  body: string;
  actionLabel: string;
};

type TemplatesResponse = { data: { templates: EmailTemplate[] } };

export default function EmailTemplatesPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => api<TemplatesResponse>("/organization/email-templates"),
  });
  const templates = query.data?.data.templates ?? [];
  const [selectedKey, setSelectedKey] = useState("");
  const [draft, setDraft] = useState<TemplateCopy>({ subject: "", title: "", body: "", actionLabel: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selected = useMemo(
    () => templates.find((item) => item.key === selectedKey) ?? templates[0] ?? null,
    [templates, selectedKey],
  );

  useEffect(() => {
    if (!templates.length) return;
    if (!selectedKey || !templates.some((item) => item.key === selectedKey)) {
      setSelectedKey(templates[0].key);
    }
  }, [templates, selectedKey]);

  useEffect(() => {
    if (!selected) return;
    setDraft({
      subject: selected.subject,
      title: selected.title,
      body: selected.body,
      actionLabel: selected.actionLabel,
    });
    setMessage("");
    setError("");
  }, [selected?.key, selected?.subject, selected?.title, selected?.body, selected?.actionLabel]);

  const save = useMutation({
    mutationFn: () =>
      api<TemplatesResponse>("/organization/email-templates", {
        method: "PATCH",
        body: JSON.stringify({
          templates: {
            [selected!.key]: {
              subject: draft.subject,
              title: draft.title,
              body: draft.body,
              actionLabel: draft.actionLabel,
            },
          },
        }),
      }),
    onSuccess: async () => {
      setMessage("Email template saved. New messages will use this wording.");
      setError("");
      await client.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "The template could not be saved."),
  });

  const reset = useMutation({
    mutationFn: () =>
      api<TemplatesResponse>("/organization/email-templates", {
        method: "PATCH",
        body: JSON.stringify({
          templates: {
            [selected!.key]: { subject: "", title: "", body: "", actionLabel: "" },
          },
        }),
      }),
    onSuccess: async () => {
      setMessage("Template restored to the default wording.");
      setError("");
      await client.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "The template could not be reset."),
  });

  const vendorTemplates = templates.filter((item) => item.audience === "vendor");
  const adminTemplates = templates.filter((item) => item.audience === "admin");

  return (
    <div className="mx-auto grid max-w-6xl gap-4">
      <PageHeader
        title="Email templates"
        description="Edit the subject, title, body, and button label for every system email. Use {{variable}} placeholders from the list for each template."
        actions={
          selected ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={!selected.customized || reset.isPending} onClick={() => reset.mutate()}>
                {reset.isPending ? "Resetting…" : "Reset to default"}
              </Button>
              <Button type="button" variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "Saving…" : "Save template"}
              </Button>
            </div>
          ) : null
        }
      />
      <Notice message={message} />
      <ErrorNote message={error} />
      {query.isLoading ? <p className="text-sm text-muted">Loading templates…</p> : null}
      {selected ? (
        <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="grid gap-4">
            <TemplateGroup title="Company emails" items={vendorTemplates} selectedKey={selected.key} onSelect={setSelectedKey} />
            <TemplateGroup title="Admin emails" items={adminTemplates} selectedKey={selected.key} onSelect={setSelectedKey} />
          </aside>
          <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">{selected.label}</h2>
                {selected.customized ? <Badge tone="info">Customized</Badge> : <Badge tone="neutral">Default</Badge>}
                <Badge tone="neutral">{selected.audience === "admin" ? "Admin" : "Company"}</Badge>
              </div>
              <p className="text-sm text-muted">{selected.description}</p>
            </div>
            <Field label="Subject">
              <input className={inputClass} value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} />
            </Field>
            <Field label="Title">
              <input className={inputClass} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
            </Field>
            <Field label="Body" hint="Plain text. Line breaks are kept in the email.">
              <textarea className={textareaClass} rows={12} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} />
            </Field>
            <Field label="Button label">
              <input className={inputClass} value={draft.actionLabel} onChange={(event) => setDraft((current) => ({ ...current, actionLabel: event.target.value }))} />
            </Field>
            <div className="grid gap-2">
              <h3 className="text-sm font-semibold">Available variables</h3>
              <ul className="grid gap-1 sm:grid-cols-2">
                {selected.variables.map((variable) => (
                  <li key={variable.key} className="rounded-md border border-border bg-secondary px-2.5 py-2 text-sm">
                    <code className="font-semibold">{`{{${variable.key}}}`}</code>
                    <span className="mt-0.5 block text-xs text-muted">{variable.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function TemplateGroup({
  title,
  items,
  selectedKey,
  onSelect,
}: {
  title: string;
  items: EmailTemplate[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="grid gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="grid gap-1">
        {items.map((item) => {
          const active = item.key === selectedKey;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                active ? "border-brand bg-brand/10 font-semibold text-foreground" : "border-border bg-surface text-foreground hover:bg-secondary"
              }`}
            >
              <span className="block">{item.label}</span>
              {item.customized ? <span className="mt-0.5 block text-xs text-muted">Customized</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
