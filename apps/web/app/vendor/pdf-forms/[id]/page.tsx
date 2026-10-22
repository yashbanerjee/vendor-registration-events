"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function VendorPdfFormPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/vendor#pdf-${params.id}`);
  }, [params.id, router]);
  return <p className="text-sm text-muted">Opening your form…</p>;
}
