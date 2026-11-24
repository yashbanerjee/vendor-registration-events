"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/ui";

export default function CategoriesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/vendors");
  }, [router]);
  return <LoadingState label="Opening vendors…" description="Taking you to the vendor list." />;
}
