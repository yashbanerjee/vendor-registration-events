"use client";

import { passwordSchema } from "@vmp/shared";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui";
import { useSession } from "@/components/providers";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { refresh } = useSession();
  const [preview, setPreview] = useState<{ email: string; companyName: string; needsPassword: boolean; purpose: string } | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ data: { email: string; companyName: string; needsPassword: boolean; purpose: string } }>("/auth/invitations/preview", {
      method: "POST",
      body: JSON.stringify({ token: params.token }),
    }).then((result) => setPreview(result.data)).catch((caught) => setError(caught instanceof ApiError ? caught.message : "This invitation is not valid."));
  }, [params.token]);

  async function continueInvitation(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (preview?.needsPassword) {
        const parsed = passwordSchema.safeParse(password);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Choose a stronger password.");
          return;
        }
        await api("/auth/invitations/accept", { method: "POST", body: JSON.stringify({ token: params.token, password, name }) });
      } else {
        await api("/auth/invitations/open", { method: "POST", body: JSON.stringify({ token: params.token }) });
      }
      await refresh();
      router.push("/vendor");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The invitation could not be opened.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={(event) => void continueInvitation(event)} className="grid w-full max-w-md gap-4 rounded-lg border border-border bg-surface p-6">
        <h1 className="text-2xl font-semibold">Invitation</h1>
        <p className="text-sm text-muted">{preview ? `${preview.companyName || "Your company"} · ${preview.email}` : "Checking the invitation…"}</p>
        <ErrorNote message={error} />
        {preview?.needsPassword ? (
          <>
            <Field label="Your name"><input className={inputClass} required value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Password" hint="At least 12 characters with upper, lower, and a number.">
              <input className={inputClass} type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field>
          </>
        ) : null}
        <Button type="submit" variant="primary" disabled={!preview}>Continue</Button>
      </form>
    </main>
  );
}
