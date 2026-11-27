"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { vendorErrorMessage } from "@/lib/errors";
import { AuthFrame, FloatingInput } from "@/components/auth-frame";
import { Button, ErrorNote, LoadingState, Notice } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await api("/auth/password/forgot", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      setSent(true);
    } catch (caught) {
      setError(vendorErrorMessage(caught, "The reset email could not be requested. Please try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      title="Reset password"
      description="Enter the email for your account. If it is registered with us, we will send a Forgot Password Reset Link."
      onSubmit={(event) => void submit(event)}
      overlay={pending ? <LoadingState variant="overlay" label="Sending reset link…" description="Preparing your password reset email." /> : null}
    >
      <ErrorNote message={error} />
      <Notice message={sent ? "If that account exists, a reset message is on its way. Check your inbox for Forgot Password Reset Link." : ""} />
      <FloatingInput
        label="Email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        disabled={pending}
      />
      <Button type="submit" variant="primary" size="xl" className="max-sm:px-4" disabled={pending}>
        Send reset link
      </Button>
      <Link className="auth-link" href="/login">Back to sign in</Link>
    </AuthFrame>
  );
}
