"use client";

import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BrandMark } from "./brand-mark";
import { useSession } from "./providers";
import { Button } from "./ui";

export function VendorFormShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  const client = useQueryClient();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login");
    else if (session.mustChangePassword) router.replace("/change-password");
  }, [loading, session, router]);

  if (loading) return <p className="p-6 text-sm text-muted">Loading form…</p>;
  if (!session) return null;

  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
        <Link href="/vendor" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-brand">
          <ArrowLeft size={16} aria-hidden />
          Back
        </Link>
        <div className="mx-auto flex items-center text-brand">
          <BrandMark compact className="h-8 w-8" />
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted sm:inline">{session.name}</span>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Sign out"
            onClick={async () => {
              await api("/auth/logout", { method: "POST" });
              client.clear();
              router.replace("/login");
            }}
          >
            <LogOut size={16} />
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-4 sm:py-6">{children}</main>
    </div>
  );
}
