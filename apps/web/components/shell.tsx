"use client";

import { Bell, ChevronLeft, ChevronRight, LogOut, Menu, Moon, Search, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { applyTheme, readTheme, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useSession } from "./providers";
import { BrandMark } from "./brand-mark";
import { Button, LoadingState, Modal, ModalActions } from "./ui";

export type NavItem = { href: string; label: string; icon: React.ReactNode; secondary?: boolean };

// Every page fills the space beside the sidebar at any screen size; the gutters match the top bar's.
const PAGE_CONTAINER = "w-full px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8";

function SignOutButton({ labelled, onBeforeOpen }: { labelled?: boolean; onBeforeOpen?: () => void }) {
  const router = useRouter();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  function ask() {
    onBeforeOpen?.();
    setOpen(true);
  }

  async function signOut() {
    setPending(true);
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // The server session may already be gone. Still leave this browser.
    }
    await client.cancelQueries({ queryKey: ["me"] });
    client.setQueryData(["me"], null);
    router.replace("/login");
  }

  return (
    <>
      {labelled ? (
        <Button type="button" className="w-full" onClick={ask}>
          <LogOut size={16} />
          Sign out
        </Button>
      ) : (
        <Button type="button" size="sm" variant="ghost" aria-label="Sign out" onClick={ask}>
          <LogOut size={16} />
        </Button>
      )}
      <Modal open={open} title="Sign out" onClose={() => { if (!pending) setOpen(false); }}>
        <p className="text-sm text-muted">Sign out of this account on this browser?</p>
        <div className="mt-4">
          <ModalActions>
            <Button type="button" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" variant="primary" disabled={pending} onClick={() => void signOut()}>
              {pending ? "Signing out…" : "Sign out"}
            </Button>
          </ModalActions>
        </div>
      </Modal>
    </>
  );
}

const THEME_NAMES: Record<ThemeChoice, string> = { light: "Light", dark: "Dark", system: "Auto" };

function ThemeToggle({ labelled }: { labelled?: boolean }) {
  const [theme, setTheme] = useState<ThemeChoice>("light");
  useEffect(() => {
    const sync = () => setTheme(readTheme());
    sync();
    window.addEventListener("theme-change", sync);
    return () => window.removeEventListener("theme-change", sync);
  }, []);
  const next: ThemeChoice = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const icon = theme === "dark" ? <Moon size={labelled ? 16 : 18} /> : <Sun size={labelled ? 16 : 18} />;
  if (labelled) {
    return (
      <Button type="button" className="w-full" aria-label={`Theme ${theme}. Activate to switch.`} onClick={() => applyTheme(next)}>
        {icon}
        {THEME_NAMES[theme]}
      </Button>
    );
  }
  return (
    <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary" aria-label={`Theme ${theme}. Activate to switch.`} onClick={() => applyTheme(next)}>
      {icon}
    </button>
  );
}

/** Closes a popover on a press outside it or on Escape. */
function useDismiss(ref: React.RefObject<HTMLElement | null>, open: boolean, onDismiss: () => void) {
  const callback = useRef(onDismiss);
  callback.current = onDismiss;
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) callback.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") callback.current();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref]);
}

export function ShellFrame({ items, home, children }: { items: NavItem[]; home: string; children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login");
    else if (session.mustChangePassword) router.replace("/change-password");
  }, [loading, session, router]);

  useEffect(() => {
    if (localStorage.getItem("sidebar") === "collapsed") setCollapsed(true);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  if (loading) return <LoadingState label="Loading workspace…" description="Getting your account ready." />;
  if (!session) return null;

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden md:grid md:grid-cols-[auto_1fr]">
      <ShellNav
        items={items}
        home={home}
        collapsed={collapsed}
        onCollapsedChange={(next) => {
          localStorage.setItem("sidebar", next ? "collapsed" : "open");
          setCollapsed(next);
        }}
        drawerOpen={drawerOpen}
        onDrawerClose={() => setDrawerOpen(false)}
      />
      <ShellMain home={home} drawerOpen={drawerOpen} onOpenDrawer={() => setDrawerOpen(true)}>
        {children}
      </ShellMain>
    </div>
  );
}

function crumbLabel(crumb: string) {
  const names: Record<string, string> = {
    exhibitions: "Events",
    vendors: "Companies",
    reviews: "Check answers",
    submissions: "All answers",
    documents: "Files",
    forms: "Forms",
    jobs: "Emails",
    audit: "History",
    settings: "Settings",
    categories: "Categories",
    assignments: "Form",
    "pdf-forms": "PDF",
    imports: "Upload",
  };
  if (/^[0-9a-f-]{16,}$/i.test(crumb)) return "";
  return names[crumb] ?? `${crumb.charAt(0).toUpperCase()}${crumb.slice(1).replaceAll("-", " ")}`;
}

function NavLinks({
  items,
  home,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  home: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-0.5 px-2 pb-4" aria-label="Primary">
      {items.map((item, index) => {
        const active = pathname === item.href || (item.href !== home && pathname.startsWith(`${item.href}/`));
        const showMore = item.secondary && !items[index - 1]?.secondary;
        return (
          <div key={item.href}>
            {showMore ? (
              <p className={cn("px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted", collapsed ? "md:sr-only" : "")}>
                More
              </p>
            ) : null}
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm md:gap-2 md:px-2 md:py-2",
                active ? "bg-[var(--badge-info-bg)] font-semibold text-[var(--badge-info-fg)]" : "text-foreground hover:bg-secondary",
                item.secondary && !active ? "text-muted" : "",
              )}
            >
              {item.icon}
              <span className={collapsed ? "md:sr-only" : ""}>{item.label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

function ShellNav({
  items,
  home,
  collapsed,
  onCollapsedChange,
  drawerOpen,
  onDrawerClose,
}: {
  items: NavItem[];
  home: string;
  collapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
  drawerOpen: boolean;
  onDrawerClose: () => void;
}) {
  const titleId = useId();
  const { session } = useSession();
  const initial = (session?.name || session?.email || "?").trim().charAt(0).toUpperCase();
  return (
    <>
      <aside
        className={cn(
          "hidden border-r border-t-4 border-t-brand border-border bg-surface md:flex md:h-dvh md:flex-col md:overflow-y-auto md:overscroll-contain",
          collapsed ? "md:w-20" : "md:w-60",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-3">
          <Link href={home} aria-label="iktva Forum 2027" className="flex items-center text-brand">
            <BrandMark compact className="h-9 w-9" />
          </Link>
          <button
            type="button"
            className="rounded p-1 hover:bg-secondary"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => onCollapsedChange(!collapsed)}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <NavLinks items={items} home={home} collapsed={collapsed} />
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-[#111111]/45 transition md:hidden",
          drawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!drawerOpen}
        onClick={onDrawerClose}
      />
      <aside
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(20rem,86vw)] flex-col border-r border-t-4 border-t-brand border-border bg-surface shadow-panel transition-transform duration-200 md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
          <Link href={home} id={titleId} aria-label="iktva Forum 2027" className="flex items-center text-brand" onClick={onDrawerClose}>
            <BrandMark compact className="h-9 w-9" />
          </Link>
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-secondary" aria-label="Close menu" onClick={onDrawerClose}>
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-2">
          <NavLinks items={items} home={home} onNavigate={onDrawerClose} />
        </div>
        <div className="shrink-0 border-t border-border px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--badge-info-bg)] text-sm font-semibold text-[var(--badge-info-fg)]" aria-hidden>
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-5">{session?.name}</p>
              <p className="truncate text-xs leading-4 text-muted">{session?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ThemeToggle labelled />
            <SignOutButton labelled onBeforeOpen={onDrawerClose} />
          </div>
        </div>
      </aside>
    </>
  );
}

function ShellMain({
  children,
  home,
  drawerOpen,
  onOpenDrawer,
}: {
  children: React.ReactNode;
  home: string;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useSession();
  const [query, setQuery] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const [openNotes, setOpenNotes] = useState(false);
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: () => api<{ data: { id: string; title: string; body: string; link: string }[] }>("/notifications") });
  const search = useQuery({
    queryKey: ["search", query],
    queryFn: () => api<{ data: { type: string; id: string; label: string; hint: string }[] }>(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length > 1,
  });
  const crumbs = pathname.split("/").filter(Boolean);
  const searchRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  useDismiss(searchRef, openSearch, () => setOpenSearch(false));
  useDismiss(notesRef, openNotes, () => setOpenNotes(false));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:gap-3 sm:px-6 lg:px-8">
        <button
          type="button"
          className="-ml-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-secondary md:hidden"
          aria-label="Open menu"
          aria-controls="mobile-nav-drawer"
          aria-expanded={drawerOpen}
          onClick={onOpenDrawer}
        >
          <Menu size={20} />
        </button>
        <Link href={home} aria-label="iktva Forum 2027" className="shrink-0 text-brand md:hidden">
          <BrandMark compact className="h-8 w-8" />
        </Link>
        <div ref={searchRef} className="relative min-w-0 flex-1">
          <label className="relative block max-w-xl">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              className="h-10 w-full min-w-0 rounded-md border border-border bg-secondary pl-9 pr-3 text-base leading-10 placeholder:text-muted sm:text-sm"
              placeholder={home.startsWith("/vendor") ? "Search" : "Search a company or event"}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpenSearch(true);
              }}
              onFocus={() => setOpenSearch(true)}
            />
          </label>
          {openSearch && query.trim().length > 1 ? (
            <div className="fixed inset-x-3 top-[3.75rem] z-30 max-h-[min(24rem,calc(100dvh-4.5rem))] overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface p-1 shadow-panel sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-1 sm:w-full sm:max-w-xl">
              {(search.data?.data ?? []).map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  className="block w-full rounded px-2.5 py-2.5 text-left text-sm hover:bg-secondary sm:px-2 sm:py-1.5"
                  onClick={() => {
                    setOpenSearch(false);
                    router.push(item.type === "vendor" ? `/admin/vendors/${item.id}` : item.type === "form" ? `/admin/forms/${item.id}` : "/admin/exhibitions");
                  }}
                >
                  {item.label} <span className="text-muted">{item.hint}</span>
                </button>
              ))}
              {(search.data?.data ?? []).length === 0 ? <p className="px-2 py-2 text-sm text-muted">No matches</p> : null}
            </div>
          ) : null}
        </div>
        <div className="hidden md:block">
          <ThemeToggle />
        </div>
        <div ref={notesRef} className="relative">
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-secondary md:h-9 md:w-9" aria-label="Notifications" aria-expanded={openNotes} onClick={() => setOpenNotes((value) => !value)}>
            <Bell size={18} />
          </button>
          {openNotes ? (
            <IsolatedScroll className="absolute right-0 z-30 mt-1 max-h-[min(24rem,calc(100dvh-4.5rem))] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface p-2 shadow-panel">
              {(notifications.data?.data ?? []).length === 0 ? <p className="px-2 py-3 text-sm text-muted">Nothing new.</p> : null}
              {notifications.data?.data.map((note) => (
                <button
                  key={note.id}
                  className="block w-full rounded px-2 py-2 text-left hover:bg-secondary"
                  onClick={async () => {
                    await api(`/notifications/${note.id}/read`, { method: "POST" });
                    setOpenNotes(false);
                    if (note.link.startsWith("/")) router.push(note.link);
                  }}
                >
                  <span className="block text-sm font-medium">{note.title}</span>
                  <span className="line-clamp-2 text-xs text-muted">{note.body}</span>
                </button>
              ))}
            </IsolatedScroll>
          ) : null}
        </div>
        <span className="hidden max-w-[14rem] truncate text-sm md:inline">{session?.name}</span>
        <div className="hidden md:block">
          <SignOutButton />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* Every page sits in this one container, so all views share the same width and gutters. */}
        <div className={PAGE_CONTAINER}>
          <nav className="mb-3 text-xs leading-4 text-muted" aria-label="Breadcrumb">
            <Link className="hover:text-foreground" href={home}>Home</Link>
            {crumbs.slice(1).map((crumb) => {
              const label = crumbLabel(crumb);
              if (!label) return null;
              return <span key={crumb}> / {label}</span>;
            })}
          </nav>
          {children}
        </div>
      </main>
    </div>
  );
}

function IsolatedScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      const max = node.scrollHeight - node.clientHeight;
      if (max > 0) node.scrollTop = Math.min(max, Math.max(0, node.scrollTop + event.deltaY));
      event.preventDefault();
      event.stopPropagation();
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
