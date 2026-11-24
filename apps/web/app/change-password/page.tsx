"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { vendorErrorMessage } from "@/lib/errors";
import { AuthFrame, FloatingInput } from "@/components/auth-frame";
import { Button, ErrorNote, LoadingState } from "@/components/ui";
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
      setError(vendorErrorMessage(caught, "The password could not be changed. Please check your details and try again."));
    }
  }

  if (loading || !session) return <LoadingState label="Loading…" description="Checking your session." />;

  return (
    <AuthFrame
      title="Change your temporary password"
      description="Use at least 12 characters, with an uppercase letter, a lowercase letter, and a number. After this, you can complete your exhibition form."
      onSubmit={(event) => void submit(event)}
    >
      <ErrorNote message={error} />
      <FloatingInput label="Temporary password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
      <FloatingInput label="New password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      <Button type="submit" variant="primary" size="xl" className="max-sm:px-4">Continue</Button>
    </AuthFrame>
  );
}
