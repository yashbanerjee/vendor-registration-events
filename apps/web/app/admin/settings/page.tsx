"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { applyTheme, readTheme, type ThemeChoice } from "@/lib/theme";
import { Badge, Button, ErrorNote, Field, Notice, PageHeader, inputClass } from "@/components/ui";

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
  storageEndpoint: string;
  storageRegion: string;
  storageBucket: string;
  storageAccessKey: string;
  storagePathStyle: boolean;
  storageSecretSet: boolean;
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
  storageEndpoint: "",
  storageRegion: "",
  storageBucket: "",
  storageAccessKey: "",
  storagePathStyle: false,
  storageSecretSet: false,
};

export default function SettingsPage() {
  const client = useQueryClient();
  const organization = useQuery({ queryKey: ["organization"], queryFn: () => api<Organization>("/organization") });
  const [form, setForm] = useState(empty);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [clearSmtpPassword, setClearSmtpPassword] = useState(false);
  const [storageSecret, setStorageSecret] = useState("");
  const [clearStorageSecret, setClearStorageSecret] = useState(false);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<ThemeChoice>("light");
  const [testTo, setTestTo] = useState("");
  const [testNote, setTestNote] = useState("");
  const [testError, setTestError] = useState("");

  useEffect(() => {
    if (!organization.data) return;
    setForm({ name: organization.data.data.name, ...organization.data.data.settings });
  }, [organization.data]);

  useEffect(() => setTheme(readTheme()), []);

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
          storageEndpoint: form.storageEndpoint,
          storageRegion: form.storageRegion,
          storageBucket: form.storageBucket,
          storageAccessKey: form.storageAccessKey,
          storageSecret,
          clearStorageSecret,
          storagePathStyle: form.storagePathStyle,
        }),
      }),
    onSuccess: async () => {
      setMessage("Settings saved for this organization.");
      setError("");
      setSmtpPassword("");
      setClearSmtpPassword(false);
      setStorageSecret("");
      setClearStorageSecret(false);
      await client.invalidateQueries({ queryKey: ["organization"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Settings could not be saved."),
  });

  const testMail = useMutation({
    mutationFn: () => api("/organization/test-email", { method: "POST", body: JSON.stringify({ to: testTo.trim() }) }),
    onSuccess: () => {
      setTestNote(`Test email sent to ${testTo.trim()}.`);
      setTestError("");
    },
    onError: (caught) => {
      setTestNote("");
      setTestError(caught instanceof ApiError ? caught.message : "The test email could not be sent.");
    },
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
    <div className="mx-auto grid max-w-6xl gap-4">
      <PageHeader
        title="Settings"
        description="The database connection stays in the server environment. Session, email, and Railway storage values are saved for this organization."
        actions={<Button type="submit" form="organization-settings" variant="primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save settings"}</Button>}
      />
      <Notice message={message} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <form
          id="organization-settings"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <ErrorNote message={error} />
          <Card title="Organization" description="Name, sign-in lifetime, and the limits applied to uploads and imports.">
            <Field label="Organization name">
              <input className={inputClass} value={form.name} onChange={(event) => set("name", event.target.value)} required />
            </Field>
            <div className="grid items-start gap-3 sm:grid-cols-2">
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
          </Card>
          <Card
            title="Email"
            description="Messages to vendors and administrators use these sender and SMTP details. A large batch waits in the queue and goes out one every 5 seconds so a mailbox limit of about 15 per minute is not exceeded."
            extra={form.smtpPasswordSet ? <Badge tone="success">Password saved</Badge> : <Badge tone="neutral">No password saved</Badge>}
          >
            <div className="grid items-start gap-3 sm:grid-cols-2">
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
            <div className="grid gap-3 rounded-md border border-border bg-secondary p-3">
              <div>
                <h3 className="text-sm font-semibold">Send a test email</h3>
                <p className="mt-1 text-xs text-muted">Uses the saved settings. Save first if you changed the host, port, or password.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Field label="Send test to">
                    <input className={inputClass} type="email" value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="name@example.com" autoComplete="off" />
                  </Field>
                </div>
                <Button type="button" variant="primary" disabled={testMail.isPending || !testTo.trim()} onClick={() => testMail.mutate()}>
                  {testMail.isPending ? "Sending…" : "Send test"}
                </Button>
              </div>
              <Notice message={testNote} />
              <ErrorNote message={testError} />
            </div>
          </Card>
          <Card
            title="Railway storage"
            description="Bucket endpoint, region, name, and access key are saved here. The secret is encrypted and is not shown again."
            extra={form.storageSecretSet ? <Badge tone="success">Secret saved</Badge> : <Badge tone="warning">Secret missing</Badge>}
          >
            <div className="grid items-start gap-3 sm:grid-cols-2">
              <Field label="Endpoint" hint="Example: https://t3.storageapi.dev">
                <input className={inputClass} value={form.storageEndpoint} onChange={(event) => set("storageEndpoint", event.target.value)} placeholder="https://t3.storageapi.dev" />
              </Field>
              <Field label="Region" hint="Railway uses auto.">
                <input className={inputClass} value={form.storageRegion} onChange={(event) => set("storageRegion", event.target.value)} placeholder="auto" />
              </Field>
              <Field label="Bucket">
                <input className={inputClass} value={form.storageBucket} onChange={(event) => set("storageBucket", event.target.value)} />
              </Field>
              <Field label="Access key">
                <input className={inputClass} value={form.storageAccessKey} onChange={(event) => set("storageAccessKey", event.target.value)} autoComplete="off" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Secret access key" hint={form.storageSecretSet ? "A secret is saved. Leave blank to keep it." : "Filled from Railway when the service starts with bucket variables."}>
                  <input className={inputClass} type="password" value={storageSecret} onChange={(event) => setStorageSecret(event.target.value)} autoComplete="new-password" />
                </Field>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.storagePathStyle} onChange={(event) => set("storagePathStyle", event.target.checked)} />
              Use path-style URLs. Leave this off for Railway virtual-hosted buckets.
            </label>
            {form.storageSecretSet ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={clearStorageSecret} onChange={(event) => setClearStorageSecret(event.target.checked)} />
                Remove the saved storage secret
              </label>
            ) : null}
          </Card>
          <div className="flex items-center justify-end">
            <Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save settings"}</Button>
          </div>
        </form>
        <aside className="grid content-start gap-4">
          <Card title="Appearance" description="Light is the default. This choice is saved in this browser.">
            <Field label="Theme">
              <select
                className={inputClass}
                value={theme}
                onChange={(event) => {
                  const next = event.target.value as ThemeChoice;
                  setTheme(next);
                  applyTheme(next);
                }}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">Match this device</option>
              </select>
            </Field>
          </Card>
          <Card title="Multi-factor authentication" description="Add a second step when this administrator signs in.">
            <Button type="button" onClick={() => setup.mutate()}>Generate authenticator secret</Button>
            {secret ? <p className="break-all rounded-md bg-secondary p-2 text-xs text-muted">{secret}</p> : null}
            <Field label="6-digit code"><input className={inputClass} inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} /></Field>
            <Button type="button" onClick={() => confirm.mutate()} disabled={!code.trim()}>Confirm code</Button>
          </Card>
          <Card title="Exports" description="Download the current organization data as CSV.">
            <div className="flex flex-wrap gap-2">
              {["vendors", "submissions", "corrections", "emails", "documents"].map((kind) => (
                <a key={kind} className="rounded-md border border-border px-2.5 py-1 text-sm capitalize hover:bg-secondary" href={`/api/v1/reports/${kind}`}>{kind}</a>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Card({ title, description, extra, children }: { title: string; description?: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}
