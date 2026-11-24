"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { vendorErrorMessage } from "@/lib/errors";
import { AuthFrame, FloatingInput } from "@/components/auth-frame";
import { Button, ErrorNote, LoadingState } from "@/components/ui";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await api("/auth/password/reset", {
        method: "POST",
        body: JSON.stringify({ token: params.token, password }),
      });
      router.push("/login");
    } catch (caught) {
      setError(vendorErrorMessage(caught, "The password could not be reset. Please try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      title="Choose a new password"
      description="Use at least 12 characters, with an uppercase letter, a lowercase letter, and a number."
      onSubmit={(event) => void submit(event)}
      overlay={pending ? <LoadingState label="Updating password…" description="Please wait a moment." /> : null}
    >
      <ErrorNote message={error} />
      <FloatingInput label="New password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={pending} />
      <Button type="submit" variant="primary" size="xl" className="max-sm:px-4" disabled={pending}>Update password</Button>
      <Link className="auth-link" href="/login">Back to sign in</Link>
    </AuthFrame>
  );
}
