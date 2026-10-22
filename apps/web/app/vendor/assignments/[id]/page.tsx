"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function VendorAssignmentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/vendor#assignment-${params.id}`);
  }, [params.id, router]);
  return <p className="text-sm text-muted">Opening your form…</p>;
}
