"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { vendorErrorMessage } from "@/lib/errors";
import { AuthFrame, FloatingInput } from "@/components/auth-frame";
import { Button, ErrorNote, LoadingState } from "@/components/ui";
import { useSession } from "@/components/providers";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const { refresh } = useSession();
  const [preview, setPreview] = useState<{ email: string; companyName: string; needsPassword: boolean; purpose: string; assignmentId: string | null } | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(true);

  useEffect(() => {
    setLoadingPreview(true);
    void api<{ data: { email: string; companyName: string; needsPassword: boolean; purpose: string; assignmentId: string | null } }>("/auth/invitations/preview", {
      method: "POST",
      body: JSON.stringify({ token: params.token }),
    })
      .then((result) => setPreview(result.data))
      .catch((caught) => setError(vendorErrorMessage(caught, "This invitation is not valid.")))
      .finally(() => setLoadingPreview(false));
  }, [params.token]);

  async function continueInvitation(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const result = preview?.needsPassword
        ? await api<{ data: { assignmentId: string | null } }>("/auth/invitations/accept", { method: "POST", body: JSON.stringify({ token: params.token, password, name }) })
        : await api<{ data: { assignmentId: string | null } }>("/auth/invitations/open", { method: "POST", body: JSON.stringify({ token: params.token }) });
      await refresh();
      await client.invalidateQueries();
      const assignmentId = result.data.assignmentId ?? preview?.assignmentId;
      router.push(assignmentId ? `/vendor/assignments/${assignmentId}` : "/vendor");
    } catch (caught) {
      setError(vendorErrorMessage(caught, "The invitation could not be opened. Please try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      title="Invitation"
      description={preview ? `${preview.companyName || "Your company"} · ${preview.email}` : "Checking the invitation…"}
      onSubmit={(event) => void continueInvitation(event)}
      overlay={
        loadingPreview || pending ? (
          <LoadingState
            label={loadingPreview ? "Checking invitation…" : "Opening invitation…"}
            description="Please wait a moment."
          />
        ) : null
      }
    >
      <ErrorNote message={error} />
      {preview?.needsPassword ? (
        <>
          <FloatingInput label="Your name" required value={name} onChange={(event) => setName(event.target.value)} disabled={pending} />
          <FloatingInput label="Password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} />
        </>
      ) : null}
      <Button type="submit" variant="primary" size="xl" className="max-sm:px-4" disabled={!preview || pending}>Continue</Button>
    </AuthFrame>
  );
}
