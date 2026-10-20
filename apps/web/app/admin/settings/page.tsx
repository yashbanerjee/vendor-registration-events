"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Field, PageHeader, inputClass } from "@/components/ui";

export default function SettingsPage() {
  const client = useQueryClient();
  const organization = useQuery({ queryKey: ["organization"], queryFn: () => api<{ data: { name: string } }>("/organization") });
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { if (organization.data) setName(organization.data.data.name); }, [organization.data]);
  const save = useMutation({
    mutationFn: () => api("/organization", { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: async () => { setMessage("Organization updated."); await client.invalidateQueries({ queryKey: ["organization"] }); },
  });
  const setup = useMutation({
    mutationFn: () => api<{ data: { secret: string; otpauthUrl: string } }>("/auth/mfa/setup", { method: "POST" }),
    onSuccess: (result) => setSecret(`${result.data.secret} ${result.data.otpauthUrl}`),
  });
  const confirm = useMutation({
    mutationFn: () => api("/auth/mfa/confirm", { method: "POST", body: JSON.stringify({ code }) }),
    onSuccess: () => setMessage("Multi-factor authentication is enabled."),
  });
  return (
    <div className="grid max-w-xl gap-4">
      <PageHeader title="Settings" description="Appearance is stored in this browser. Multi-factor authentication is recommended for administrators." />
      {message ? <p className="text-sm text-success">{message}</p> : null}
      <form className="grid gap-3 rounded-lg border border-border bg-surface p-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <Field label="Organization name"><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Button type="submit" variant="primary">Save</Button>
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
