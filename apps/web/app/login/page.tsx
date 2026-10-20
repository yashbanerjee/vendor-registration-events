"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui";
import { useSession } from "@/components/providers";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [email, setEmail] = useState("admin@harbor.example");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (mfaToken) {
        await api("/auth/mfa/verify", { method: "POST", body: JSON.stringify({ mfaToken, code }) });
      } else {
        const result = await api<{ data: { mfaRequired: boolean; mfaToken?: string } }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        if (result.data.mfaRequired && result.data.mfaToken) {
          setMfaToken(result.data.mfaToken);
          return;
        }
      }
      const me = await api<{ data: { vendorId: string | null } }>("/auth/me");
      await refresh();
      router.push(me.data.vendorId ? "/vendor" : "/admin");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Sign-in failed.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={(event) => void submit(event)} className="grid w-full max-w-md gap-4 rounded-lg border border-border bg-surface p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Exhibition operations</p>
          <h1 className="text-2xl font-semibold">Sign in</h1>
        </div>
        <ErrorNote message={error} />
        {mfaToken ? (
          <Field label="Authentication code">
            <input className={inputClass} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required />
          </Field>
        ) : (
          <>
            <Field label="Email">
              <input className={inputClass} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </Field>
            <Field label="Password">
              <input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </Field>
          </>
        )}
        <Button type="submit" variant="primary">Continue</Button>
      </form>
    </main>
  );
}
