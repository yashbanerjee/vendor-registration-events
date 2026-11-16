"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingState } from "@/components/ui";
import { useSession } from "@/components/providers";

export default function HomePage() {
  const { session, loading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login");
    else router.replace(session.vendorId ? "/vendor" : "/admin");
  }, [loading, session, router]);
  return <LoadingState label="Opening your workspace…" description="Checking your sign-in and routing you to the right place." />;
}
