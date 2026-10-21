"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui";
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

  if (loading || !session) return <p className="p-6 text-sm text-muted">Loading…</p>;

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={(event) => void submit(event)} className="grid w-full max-w-md gap-4 rounded-lg border border-border bg-surface p-6">
        <div>
          <BrandMark className="mb-3 h-16 w-16 object-contain" />
          <h1 className="text-2xl font-semibold">Change your temporary password</h1>
          <p className="mt-1 text-sm text-muted">Use at least 12 characters, with an uppercase letter, a lowercase letter, and a number. After this, you can complete your exhibition form.</p>
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
