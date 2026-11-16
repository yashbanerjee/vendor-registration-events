"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui";
import { useSession } from "@/components/providers";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const { refresh } = useSession();
  const [preview, setPreview] = useState<{ email: string; companyName: string; needsPassword: boolean; purpose: string; assignmentId: string | null } | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ data: { email: string; companyName: string; needsPassword: boolean; purpose: string; assignmentId: string | null } }>("/auth/invitations/preview", {
      method: "POST",
      body: JSON.stringify({ token: params.token }),
    }).then((result) => setPreview(result.data)).catch((caught) => setError(caught instanceof ApiError ? caught.message : "This invitation is not valid."));
  }, [params.token]);

  async function continueInvitation(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = preview?.needsPassword
        ? await api<{ data: { assignmentId: string | null } }>("/auth/invitations/accept", { method: "POST", body: JSON.stringify({ token: params.token, password, name }) })
        : await api<{ data: { assignmentId: string | null } }>("/auth/invitations/open", { method: "POST", body: JSON.stringify({ token: params.token }) });
      await refresh();
      await client.invalidateQueries();
      const assignmentId = result.data.assignmentId ?? preview?.assignmentId;
      router.push(assignmentId ? `/vendor/assignments/${assignmentId}` : "/vendor");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The invitation could not be opened.");
    }
  }

  return (
    <main className="auth-screen">
      <form onSubmit={(event) => void continueInvitation(event)} className="auth-card">
        <div>
          <BrandMark className="mb-4 h-12 w-auto max-w-[220px]" />
          <h1 className="text-2xl font-semibold tracking-tight">Invitation</h1>
          <p className="mt-1 break-words text-sm leading-5 text-muted">{preview ? `${preview.companyName || "Your company"} · ${preview.email}` : "Checking the invitation…"}</p>
        </div>
        <ErrorNote message={error} />
        {preview?.needsPassword ? (
          <>
            <Field label="Your name"><input className={inputClass} required value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Password">
              <input className={inputClass} type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field>
          </>
        ) : null}
        <Button type="submit" variant="primary" disabled={!preview}>Continue</Button>
      </form>
    </main>
  );
}
