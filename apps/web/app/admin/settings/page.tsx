"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Button, ErrorNote, Field, PageHeader, inputClass } from "@/components/ui";

type Settings = {
  sessionTtlHours: number;
  invitationTtlHours: number;
  maxUploadMb: number;
  importMaxRows: number;
  emailFromName: string;
  emailFromAddress: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPasswordSet: boolean;
};

type Organization = {
  data: {
    name: string;
    settings: Settings;
    limits: { maxUploadMb: number; importMaxRows: number };
  };
};

const empty: Settings & { name: string } = {
  name: "",
  sessionTtlHours: 12,
  invitationTtlHours: 72,
  maxUploadMb: 20,
  importMaxRows: 5000,
  emailFromName: "",
  emailFromAddress: "",
  smtpHost: "",
  smtpPort: 1025,
  smtpSecure: false,
  smtpUser: "",
  smtpPasswordSet: false,
};

export default function SettingsPage() {
  const client = useQueryClient();
  const organization = useQuery({ queryKey: ["organization"], queryFn: () => api<Organization>("/organization") });
  const [form, setForm] = useState(empty);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [clearSmtpPassword, setClearSmtpPassword] = useState(false);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organization.data) return;
    setForm({ name: organization.data.data.name, ...organization.data.data.settings });
  }, [organization.data]);

  const save = useMutation({
    mutationFn: () =>
      api("/organization", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          sessionTtlHours: Number(form.sessionTtlHours),
          invitationTtlHours: Number(form.invitationTtlHours),
          maxUploadMb: Number(form.maxUploadMb),
          importMaxRows: Number(form.importMaxRows),
          emailFromName: form.emailFromName,
          emailFromAddress: form.emailFromAddress,
          smtpHost: form.smtpHost,
          smtpPort: Number(form.smtpPort),
          smtpSecure: form.smtpSecure,
          smtpUser: form.smtpUser,
          smtpPassword,
          clearSmtpPassword,
        }),
      }),
    onSuccess: async () => {
      setMessage("Settings saved for this organization.");
      setError("");
      setSmtpPassword("");
      setClearSmtpPassword(false);
      await client.invalidateQueries({ queryKey: ["organization"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Settings could not be saved."),
  });

  const setup = useMutation({
    mutationFn: () => api<{ data: { secret: string; otpauthUrl: string } }>("/auth/mfa/setup", { method: "POST" }),
    onSuccess: (result) => setSecret(`${result.data.secret} ${result.data.otpauthUrl}`),
  });
  const confirm = useMutation({
    mutationFn: () => api("/auth/mfa/confirm", { method: "POST", body: JSON.stringify({ code }) }),
    onSuccess: () => setMessage("Multi-factor authentication is enabled."),
  });

  const limits = organization.data?.data.limits;
  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <PageHeader
        title="Settings"
        description="The database connection stays in the server environment. These values apply to this organization and override the server defaults."
      />
      {message ? <p className="text-sm text-success">{message}</p> : null}
      <form
        className="grid gap-4 rounded-lg border border-border bg-surface p-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <ErrorNote message={error} />
        <Field label="Organization name">
          <input className={inputClass} value={form.name} onChange={(event) => set("name", event.target.value)} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Session length (hours)" hint="New sign-ins use this lifetime.">
            <input className={inputClass} type="number" min={1} max={336} value={form.sessionTtlHours} onChange={(event) => set("sessionTtlHours", Number(event.target.value))} required />
          </Field>
          <Field label="Invitation length (hours)">
            <input className={inputClass} type="number" min={1} max={720} value={form.invitationTtlHours} onChange={(event) => set("invitationTtlHours", Number(event.target.value))} required />
          </Field>
          <Field label="Maximum upload (MB)" hint={limits ? `Server ceiling: ${limits.maxUploadMb} MB.` : undefined}>
            <input className={inputClass} type="number" min={1} max={limits?.maxUploadMb ?? 100} value={form.maxUploadMb} onChange={(event) => set("maxUploadMb", Number(event.target.value))} required />
          </Field>
          <Field label="Import row limit" hint={limits ? `Server ceiling: ${limits.importMaxRows} rows.` : undefined}>
            <input className={inputClass} type="number" min={1} max={limits?.importMaxRows ?? 50000} value={form.importMaxRows} onChange={(event) => set("importMaxRows", Number(event.target.value))} required />
          </Field>
        </div>
        <h2 className="text-sm font-semibold">Email</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From name">
            <input className={inputClass} value={form.emailFromName} onChange={(event) => set("emailFromName", event.target.value)} required />
          </Field>
          <Field label="From address">
            <input className={inputClass} type="email" value={form.emailFromAddress} onChange={(event) => set("emailFromAddress", event.target.value)} required />
          </Field>
          <Field label="SMTP host" hint="Leave blank to use the server mail host.">
            <input className={inputClass} value={form.smtpHost} onChange={(event) => set("smtpHost", event.target.value)} />
          </Field>
          <Field label="SMTP port">
            <input className={inputClass} type="number" min={1} max={65535} value={form.smtpPort} onChange={(event) => set("smtpPort", Number(event.target.value))} required />
          </Field>
          <Field label="SMTP username">
            <input className={inputClass} value={form.smtpUser} onChange={(event) => set("smtpUser", event.target.value)} autoComplete="off" />
          </Field>
          <Field label="SMTP password" hint={form.smtpPasswordSet ? "A password is saved. Leave blank to keep it." : "Leave blank to use the server password."}>
            <input className={inputClass} type="password" value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} autoComplete="new-password" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.smtpSecure} onChange={(event) => set("smtpSecure", event.target.checked)} />
          Use TLS for SMTP
        </label>
        {form.smtpPasswordSet ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={clearSmtpPassword} onChange={(event) => setClearSmtpPassword(event.target.checked)} />
            Remove the saved SMTP password and use the server password
          </label>
        ) : null}
        <Button type="submit" variant="primary" disabled={save.isPending}>Save settings</Button>
      </form>
      <section className="grid gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Multi-factor authentication</h2>
        <Button onClick={() => setup.mutate()}>Generate authenticator secret</Button>
        {secret ? <p className="break-all text-xs text-muted">{secret}</p> : null}
        <Field label="6-digit code"><input className={inputClass} value={code} onChange={(event) => setCode(event.target.value)} /></Field>
        <Button onClick={() => confirm.mutate()}>Confirm code</Button>
      </section>
      <section className="rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="font-semibold">Exports</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {["vendors", "submissions", "corrections", "emails", "documents"].map((kind) => (
            <a key={kind} className="underline" href={`/api/v1/reports/${kind}`}>{kind}</a>
          ))}
        </div>
      </section>
    </div>
  );
}
