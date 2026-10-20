"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/components/providers";

export default function HomePage() {
  const { session, loading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login");
    else router.replace(session.vendorId ? "/vendor" : "/admin");
  }, [loading, session, router]);
  return <p className="p-6 text-sm text-muted">Opening your workspace…</p>;
}
