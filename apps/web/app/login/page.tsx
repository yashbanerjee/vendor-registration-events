"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { vendorErrorMessage } from "@/lib/errors";
import { AuthFrame, FloatingInput } from "@/components/auth-frame";
import { Button, ErrorNote, LoadingState, Notice } from "@/components/ui";
import { useSession } from "@/components/providers";

type Mode = "sign-in" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setSent(false);
    setMfaToken("");
    setCode("");
    setPassword("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      if (mode === "reset") {
        await api("/auth/password/forgot", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
        setSent(true);
        return;
      }
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
      const me = await api<{ data: { vendorId: string | null; mustChangePassword: boolean } }>("/auth/me");
      await refresh();
      if (me.data.mustChangePassword) router.push("/change-password");
      else router.push(me.data.vendorId ? "/vendor" : "/admin");
    } catch (caught) {
      setError(
        vendorErrorMessage(
          caught,
          mode === "reset"
            ? "The reset email could not be requested. Please try again."
            : "Sign-in failed. Please check your details and try again.",
        ),
      );
    } finally {
      setPending(false);
    }
  }

  const resetting = mode === "reset";

  return (
    <AuthFrame
      title={resetting ? "Reset password" : "Sign in"}
      description={
        resetting
          ? "Enter the email for your account. If it is registered with us, we will send a Forgot Password Reset Link."
          : undefined
      }
      onSubmit={(event) => void submit(event)}
      overlay={
        pending ? (
          <LoadingState
            variant="overlay"
            label={resetting ? "Sending reset link…" : "Signing you in…"}
            description={resetting ? "Preparing your password reset email." : "Preparing your workspace."}
          />
        ) : null
      }
    >
      <ErrorNote message={error} />
      <Notice message={sent ? "If that account exists, a reset message is on its way. Check your inbox for Forgot Password Reset Link." : ""} />

      {mfaToken && !resetting ? (
        <FloatingInput
          label="Authentication code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
          disabled={pending}
        />
      ) : (
        <>
          <FloatingInput
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={pending}
          />
          {!resetting ? (
            <FloatingInput
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={pending}
            />
          ) : null}
        </>
      )}

      <Button type="submit" variant="primary" size="xl" className="max-sm:px-4" disabled={pending}>
        {resetting ? "Send reset link" : "Continue"}
      </Button>

      {resetting ? (
        <Button type="button" variant="secondary" size="xl" className="max-sm:px-4" disabled={pending} onClick={() => switchMode("sign-in")}>
          Back to sign in
        </Button>
      ) : !mfaToken ? (
        <Button type="button" variant="secondary" size="xl" className="max-sm:px-4" disabled={pending} onClick={() => switchMode("reset")}>
          Reset password
        </Button>
      ) : null}
    </AuthFrame>
  );
}
