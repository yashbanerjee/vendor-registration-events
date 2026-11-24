"use client";

import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BRAND_LOGO } from "./brand-mark";
import { useSession } from "./providers";
import { LoadingState } from "@/components/ui/loader";

/**
 * The page a vendor fills a form on. It copies the parent registration site: a dark page with
 * the logo bar on top and one centered card. It stays dark even when the portal theme is light.
 */
export function VendorFormShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  const client = useQueryClient();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login");
    else if (session.mustChangePassword) router.replace("/change-password");
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="dark brand-page font-form">
        <LoadingState label="Loading form…" description="Getting your registration ready." />
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="dark brand-page font-form">
      <nav className="brand-nav" aria-label="Form">
        <Link href="/vendor" aria-label="iktva Forum 2027, back to My form" className="shrink-0">
          <img src={BRAND_LOGO} alt="iktva Forum 2027" className="brand-nav-logo" />
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          <span className="hidden max-w-[16rem] truncate px-2 text-[0.78rem] font-medium uppercase tracking-[0.08em] text-muted md:inline">{session.name || "User"}</span>
          <Link href="/vendor" className="brand-nav-link">
            <ArrowLeft size={14} aria-hidden />
            Back
          </Link>
          <button
            type="button"
            className="brand-nav-link"
            aria-label="Sign out"
            onClick={async () => {
              await api("/auth/logout", { method: "POST" });
              client.clear();
              router.replace("/login");
            }}
          >
            <LogOut size={14} aria-hidden />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </nav>
      <main className="px-[4%] pb-16">
        <div className="brand-shell">{children}</div>
      </main>
    </div>
  );
}
