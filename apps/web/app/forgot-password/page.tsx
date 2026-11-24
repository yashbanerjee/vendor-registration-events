"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { vendorErrorMessage } from "@/lib/errors";
import { AuthFrame, FloatingInput } from "@/components/auth-frame";
import { Button, ErrorNote, Notice } from "@/components/ui";

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
      setError(vendorErrorMessage(caught, "The reset email could not be requested. Please try again."));
    }
  }

  return (
    <AuthFrame
      title="Forgot password"
      description="We will email a one-hour reset link if an active account matches this address."
      onSubmit={(event) => void submit(event)}
    >
      <ErrorNote message={error} />
      <Notice message={sent ? "If that account exists, a reset message is on its way." : ""} />
      <FloatingInput label="Email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <Button type="submit" variant="primary" size="xl" className="max-sm:px-4">Send reset link</Button>
      <Link className="auth-link" href="/login">Back to sign in</Link>
    </AuthFrame>
  );
}
