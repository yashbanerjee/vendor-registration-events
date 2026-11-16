"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { Button, ErrorNote, Field, LoadingState, inputClass } from "@/components/ui";
import { useSession } from "@/components/providers";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { session, loading, refresh } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/auth/password/change", {
        method: "POST",
        body: JSON.stringify({ currentPassword, password }),
      });
      await refresh();
      router.push(session?.vendorId ? "/vendor" : "/admin");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The password could not be changed.");
    }
  }

  if (loading || !session) return <LoadingState label="Loading…" description="Checking your session." />;

  return (
    <main className="auth-screen">
      <form onSubmit={(event) => void submit(event)} className="auth-card">
        <div>
          <BrandMark className="mb-4 h-12 w-auto max-w-[220px]" />
          <h1 className="text-2xl font-semibold tracking-tight">Change your temporary password</h1>
          <p className="mt-1 text-sm leading-5 text-muted">Use at least 12 characters, with an uppercase letter, a lowercase letter, and a number. After this, you can complete your exhibition form.</p>
        </div>
        <ErrorNote message={error} />
        <Field label="Temporary password">
          <input className={inputClass} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        </Field>
        <Field label="New password">
          <input className={inputClass} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </Field>
        <Button type="submit" variant="primary">Continue</Button>
      </form>
    </main>
  );
}
