"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Button, ErrorNote, Field, Notice, inputClass } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The reset email could not be requested.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={(event) => void submit(event)} className="grid w-full max-w-md gap-4 rounded-lg border border-border bg-surface p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Account recovery</p>
          <h1 className="text-2xl font-semibold">Forgot password</h1>
          <p className="mt-1 text-sm text-muted">We will email a one-hour reset link if an active account matches this address.</p>
        </div>
        <ErrorNote message={error} />
        <Notice message={sent ? "If that account exists, a reset message is on its way." : ""} />
        <Field label="Email">
          <input className={inputClass} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Button type="submit" variant="primary">Send reset link</Button>
        <Link className="text-sm underline" href="/login">Back to sign in</Link>
      </form>
    </main>
  );
}
