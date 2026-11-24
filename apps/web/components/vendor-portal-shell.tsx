"use client";

import { ClipboardList, FileText, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BRAND_LOGO } from "./brand-mark";
import { useSession } from "./providers";
import { LoadingState } from "@/components/ui/loader";

const items = [
  { href: "/vendor", label: "My form", icon: ClipboardList, exact: true },
  { href: "/vendor/documents", label: "My files", icon: FileText, exact: false },
] as const;

/**
 * Vendor home and files pages. Same dark brand page and logo bar as the form,
 * with My form / My files links in the top bar instead of the old sidebar.
 */
export function VendorPortalShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const client = useQueryClient();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login");
    else if (session.mustChangePassword) router.replace("/change-password");
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="dark brand-page font-form">
        <LoadingState label="Loading workspace…" description="Getting your account ready." />
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="dark brand-page font-form">
      <nav className="brand-nav" aria-label="Vendor portal">
        <Link href="/vendor" aria-label="iktva Forum 2027" className="shrink-0">
          <img src={BRAND_LOGO} alt="iktva Forum 2027" className="brand-nav-logo" />
        </Link>
        <div className="ml-2 flex min-w-0 items-center gap-0.5 sm:ml-4 sm:gap-1" role="navigation" aria-label="Primary">
          {items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("brand-nav-link", active && "is-active")}
              >
                <Icon size={14} aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          <span className="hidden max-w-[16rem] truncate px-2 text-[0.78rem] font-medium uppercase tracking-[0.08em] text-muted md:inline">{session.name || "User"}</span>
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
