"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingState } from "@/components/ui";

export default function VendorPdfFormPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/vendor#pdf-${params.id}`);
  }, [params.id, router]);
  return <LoadingState label="Opening your form…" description="Taking you to the PDF packet." />;
}
