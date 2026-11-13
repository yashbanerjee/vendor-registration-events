"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { VendorAssignmentForm, type VendorAssignment } from "@/components/vendor-assignment-form";
import { api } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/errors";
import { ErrorNote } from "@/components/ui";

export default function VendorAssignmentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assignment = useQuery({
    queryKey: ["assignment", params.id],
    queryFn: () => api<{ data: VendorAssignment }>(`/assignments/${params.id}`),
  });

  if (assignment.isLoading) return <p className="text-sm text-muted">Loading your form…</p>;
  if (assignment.isError || !assignment.data?.data) {
    return (
      <div className="grid gap-3">
        <ErrorNote message={friendlyErrorMessage(assignment.error, "This form could not be opened. Please go back and try again.")} />
        <button type="button" className="justify-self-start text-sm font-semibold text-brand underline" onClick={() => router.replace("/vendor")}>
          Back to My form
        </button>
      </div>
    );
  }

  return (
    <VendorAssignmentForm
      assignment={assignment.data.data}
      onSubmitted={() => router.replace("/vendor?submitted=1")}
    />
  );
}
