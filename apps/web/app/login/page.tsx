"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/errors";
import { AuthFrame, FloatingInput } from "@/components/auth-frame";
import { Button, ErrorNote, LoadingState, Spinner } from "@/components/ui";
import { useSession } from "@/components/providers";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
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
      const me = await api<{ data: { vendorId: string | null; mustChangePassword: boolean } }>("/auth/me");
      await refresh();
      if (me.data.mustChangePassword) router.push("/change-password");
      else router.push(me.data.vendorId ? "/vendor" : "/admin");
    } catch (caught) {
      setError(friendlyErrorMessage(caught, "Sign-in failed. Please check your details and try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      title="Sign in"
      onSubmit={(event) => void submit(event)}
      overlay={pending ? <LoadingState variant="overlay" label="Signing you in…" description="Preparing your workspace." /> : null}
    >
      <ErrorNote message={error} />
      {mfaToken ? (
        <FloatingInput label="Authentication code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required disabled={pending} />
      ) : (
        <>
          <FloatingInput label="Email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={pending} />
          <FloatingInput label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={pending} />
        </>
      )}
      <Button type="submit" variant="primary" size="xl" className="max-sm:px-4" disabled={pending}>
        {pending ? <Spinner size="sm" /> : null}
        {pending ? "Signing in…" : "Continue"}
      </Button>
      <Link className="auth-link" href="/forgot-password">Forgot password?</Link>
    </AuthFrame>
  );
}
