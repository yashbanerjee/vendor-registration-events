"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Badge, Button, ErrorNote, Field, LoadingState, Notice, PageHeader, inputClass, textareaClass } from "@/components/ui";

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
    <div>
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
      <ErrorNote className="mb-3" message={error} />
      {query.isLoading ? <LoadingState label="Loading templates…" description="Fetching email templates." /> : null}
      {selected ? (
        <div className="grid items-start gap-4 xl:grid-cols-[240px_minmax(0,1fr)_minmax(280px,360px)]">
          {/* Phones and tablets pick the template from one menu instead of scrolling past the whole list. */}
          <div className="xl:hidden">
            <Field label="Template">
              <select className={inputClass} value={selected.key} onChange={(event) => setSelectedKey(event.target.value)}>
                {vendorTemplates.length ? (
                  <optgroup label="Company emails">
                    {vendorTemplates.map((item) => <option key={item.key} value={item.key}>{item.label}{item.customized ? " (customized)" : ""}</option>)}
                  </optgroup>
                ) : null}
                {adminTemplates.length ? (
                  <optgroup label="Admin emails">
                    {adminTemplates.map((item) => <option key={item.key} value={item.key}>{item.label}{item.customized ? " (customized)" : ""}</option>)}
                  </optgroup>
                ) : null}
              </select>
            </Field>
          </div>
          <aside className="hidden gap-4 xl:grid">
            <TemplateGroup title="Company emails" items={vendorTemplates} selectedKey={selected.key} onSelect={setSelectedKey} />
            <TemplateGroup title="Admin emails" items={adminTemplates} selectedKey={selected.key} onSelect={setSelectedKey} />
          </aside>
          <section className="panel grid min-w-0 gap-4 p-4 sm:p-5">
            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold uppercase tracking-[0.04em] text-[var(--heading)]">{selected.label}</h2>
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
              <h3 className="section-title mb-0">Available variables</h3>
              <ul className="grid gap-1 sm:grid-cols-2">
                {selected.variables.map((variable) => (
                  <li key={variable.key} className="min-w-0 rounded-md border border-[var(--field-border)] bg-field px-2.5 py-2 text-sm">
                    <code className="break-all font-semibold text-[var(--link)]">{`{{${variable.key}}}`}</code>
                    <span className="mt-0.5 block text-xs text-muted">{variable.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <EmailPreview
            audience={selected.audience}
            title={draft.title || "Email title"}
            body={draft.body || "Email body"}
            actionLabel={draft.actionLabel || "Open the portal"}
            subject={draft.subject}
          />
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
      <h2 className="eyebrow">{title}</h2>
      <div className="grid gap-1">
        {items.map((item) => {
          const active = item.key === selectedKey;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                active
                  ? "border-[color-mix(in_srgb,var(--brand)_55%,transparent)] bg-[color-mix(in_srgb,var(--brand)_13%,transparent)] font-semibold text-[var(--heading)] shadow-[inset_2px_0_0_var(--brand)]"
                  : "border-border bg-surface text-foreground hover:bg-secondary"
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

const EMAIL_BRAND_NAME = "iktva 2027";
const EMAIL_LOGO = "/logo-iktva-forum.png";

/** Live preview of the dark branded email that recipients will receive. */
function EmailPreview({
  title,
  body,
  actionLabel,
  subject,
}: {
  audience: "vendor" | "admin";
  title: string;
  body: string;
  actionLabel: string;
  subject: string;
}) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <aside className="grid min-w-0 gap-3 xl:sticky xl:top-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="section-title mb-0">Email preview</h2>
        {subject ? <p className="max-w-full truncate text-xs text-muted" title={subject}>Subject: {subject}</p> : null}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[#07090b] p-4 sm:p-5">
        <div className="mb-4">
          <img src={EMAIL_LOGO} alt={EMAIL_BRAND_NAME} className="h-12 w-auto max-w-full" />
        </div>
        <div className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#111519] shadow-[0_30px_70px_rgba(0,0,0,0.55)]">
          <div className="h-1 bg-[linear-gradient(90deg,#dda36c,#ad642d_28%,#4a7cb9_68%,#009ef0)]" aria-hidden />
          <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_42%)] p-5 font-form sm:p-6">
            <h3 className="text-[1.25rem] font-bold uppercase leading-snug tracking-[0.03em] text-white">{title}</h3>
            <span className="mt-4 block h-[3px] w-[52px] bg-[linear-gradient(90deg,#dda36c,#009ef0)]" aria-hidden />

            <div className="mt-5 rounded-md border border-[rgba(255,255,255,0.08)] bg-[#1a2027] px-4 py-4">
              <div className="space-y-3 text-[0.95rem] leading-6 text-[#d7e0e8]">
                {paragraphs.length ? paragraphs.map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-wrap break-words">{paragraph}</p>
                )) : (
                  <p className="text-dim">Email body</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center text-center">
              <span className="inline-flex h-[48px] items-center rounded border border-[#009ef0] bg-primary px-8 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white shadow-[0_14px_30px_rgba(0,100,173,0.35)]">
                {actionLabel}
              </span>
              <p className="mt-4 max-w-full break-all text-[11px] leading-5 text-dim">
                If the button does not work, copy and paste this link into your browser:
                <br />
                <span className="text-[var(--link)] underline">https://example.com/action</span>
              </p>
            </div>
          </div>
          <div className="h-[3px] bg-[linear-gradient(90deg,#009ef0,#4a7cb9_40%,#ad642d_75%,#dda36c)]" aria-hidden />
        </div>
        <p className="mt-4 text-center text-xs font-semibold tracking-[0.04em] text-[#d1a06e]">{EMAIL_BRAND_NAME}</p>
      </div>
    </aside>
  );
}
