"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/auth/password/reset", {
        method: "POST",
        body: JSON.stringify({ token: params.token, password }),
      });
      router.push("/login");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The password could not be reset.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={(event) => void submit(event)} className="grid w-full max-w-md gap-4 rounded-lg border border-border bg-surface p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Account recovery</p>
          <h1 className="text-2xl font-semibold">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted">Use at least 12 characters, with an uppercase letter, a lowercase letter, and a number.</p>
        </div>
        <ErrorNote message={error} />
        <Field label="New password">
          <input className={inputClass} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </Field>
        <Button type="submit" variant="primary">Update password</Button>
        <Link className="text-sm underline" href="/login">Back to sign in</Link>
      </form>
    </main>
  );
}
