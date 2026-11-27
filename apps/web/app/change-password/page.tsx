"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { passwordSchema } from "@vmp/shared";
import { ApiError, api } from "@/lib/api";
import { vendorErrorMessage, vendorFieldMessage } from "@/lib/errors";
import { AuthFrame, FloatingInput } from "@/components/auth-frame";
import { Button, ErrorNote, LoadingState } from "@/components/ui";
import { useSession } from "@/components/providers";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { session, loading, refresh } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const check = passwordSchema.safeParse(password);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Use at least 8 characters.");
      return;
    }
    setError("");
    setPending(true);
    try {
      await api("/auth/password/change", {
        method: "POST",
        body: JSON.stringify({ currentPassword, password }),
      });
      await refresh();
      router.push(session?.vendorId ? "/vendor" : "/admin");
    } catch (caught) {
      if (caught instanceof ApiError && Array.isArray(caught.details)) {
        const detail = caught.details.find(
          (item): item is { message: string } => Boolean(item && typeof item === "object" && "message" in item && typeof (item as { message?: unknown }).message === "string"),
        );
        if (detail) {
          setError(vendorFieldMessage(detail.message, "Use at least 8 characters."));
          return;
        }
      }
      setError(vendorErrorMessage(caught, "The password could not be changed. Please check your details and try again."));
    } finally {
      setPending(false);
    }
  }

  if (loading || !session) return <LoadingState label="Loading…" description="Checking your session." />;

  return (
    <AuthFrame
      title="Change your temporary password"
      description="Use at least 8 characters. After this, you can complete your exhibition form."
      onSubmit={(event) => void submit(event)}
      overlay={pending ? <LoadingState label="Updating password…" description="Please wait a moment." /> : null}
    >
      <ErrorNote message={error} />
      <FloatingInput label="Temporary password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required disabled={pending} />
      <FloatingInput label="New password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={pending} />
      <Button type="submit" variant="primary" size="xl" className="max-sm:px-4" disabled={pending}>Continue</Button>
    </AuthFrame>
  );
}
