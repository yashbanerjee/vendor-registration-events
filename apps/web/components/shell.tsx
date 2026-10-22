"use client";

import { Bell, ChevronLeft, ChevronRight, LogOut, Menu, Moon, Search, Sun, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { applyTheme, readTheme, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useSession } from "./providers";
import { BrandMark } from "./brand-mark";
import { Button, Modal } from "./ui";

export type NavItem = { href: string; label: string; icon: React.ReactNode; secondary?: boolean };

export function AppShell({ items, home }: { items: NavItem[]; home: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const [openNotes, setOpenNotes] = useState(false);
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ data: { id: string; title: string; body: string; readAt: string | null; link: string }[] }>("/notifications"),
  });
  const search = useQuery({
    queryKey: ["search", query],
    queryFn: () => api<{ data: { type: string; id: string; label: string; hint: string }[] }>(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length > 1,
  });

  useEffect(() => {
    const stored = localStorage.getItem("sidebar");
    if (stored === "collapsed") setCollapsed(true);
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      localStorage.setItem("sidebar", current ? "open" : "collapsed");
      return !current;
    });
  }

  const crumbs = pathname.split("/").filter(Boolean);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[auto_1fr]">
      <aside className={cn("border-b border-t-4 border-t-brand border-border bg-surface md:min-h-screen md:border-b-0 md:border-r", collapsed ? "md:w-20" : "md:w-60")}>
        <div className="flex h-14 items-center justify-between px-3">
          <Link href={home} aria-label="s7" className="flex items-center text-brand">
            <BrandMark className="h-9 w-9 object-contain" />
          </Link>
          <button className="hidden rounded p-1 hover:bg-secondary md:inline-flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleSidebar}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <nav className="flex gap-1 overflow-auto px-2 pb-3 md:block" aria-label="Primary">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== home && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={cn("flex items-center gap-2 rounded-md px-2 py-2 text-sm", active ? "bg-[var(--badge-info-bg)] font-semibold text-[var(--badge-info-fg)]" : "hover:bg-secondary")} aria-current={active ? "page" : undefined}>
                {item.icon}
                {!collapsed ? item.label : <span className="sr-only">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
          <Menu className="md:hidden" size={18} aria-hidden />
          <div className="relative min-w-0 flex-1">
            <label className="relative block max-w-xl">
              <span className="sr-only">Search</span>
              <Search className="pointer-events-none absolute left-2 top-2 text-muted" size={16} />
              <input className="h-8 w-full rounded-md border border-border bg-secondary pl-8 pr-3 text-sm" placeholder="Search vendors, exhibitions, forms" value={query} onChange={(event) => { setQuery(event.target.value); setOpenSearch(true); }} onFocus={() => setOpenSearch(true)} />
            </label>
            {openSearch && query.trim().length > 1 ? (
              <div className="absolute z-30 mt-1 w-full max-w-xl rounded-md border border-border bg-surface p-1 shadow-panel" role="listbox">
                {(search.data?.data ?? []).length === 0 ? <p className="px-2 py-2 text-sm text-muted">No matches</p> : null}
                {search.data?.data.map((item) => (
                  <button key={`${item.type}-${item.id}`} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary" onClick={() => { setOpenSearch(false); router.push(item.type === "vendor" ? `/admin/vendors/${item.id}` : item.type === "form" ? `/admin/forms/${item.id}` : "/admin/exhibitions"); }}>
                    <span className="font-medium">{item.label}</span>
                    <span className="ml-2 text-muted">{item.hint}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <ThemeToggle />
          <div className="relative">
            <button className="rounded p-2 hover:bg-secondary" aria-label="Notifications" onClick={() => setOpenNotes((value) => !value)}>
              <Bell size={18} />
            </button>
            {openNotes ? (
              <div className="absolute right-0 z-30 mt-1 w-80 rounded-md border border-border bg-surface p-2 shadow-panel">
                <p className="px-2 py-1 text-xs font-semibold uppercase text-muted">Notifications</p>
                {(notifications.data?.data ?? []).length === 0 ? <p className="px-2 py-3 text-sm text-muted">Nothing new.</p> : null}
                {notifications.data?.data.map((note) => (
                  <button key={note.id} className="block w-full rounded px-2 py-2 text-left hover:bg-secondary" onClick={async () => { await api(`/notifications/${note.id}/read`, { method: "POST" }); await notifications.refetch(); if (note.link) router.push(note.link); }}>
                    <span className="block text-sm font-medium">{note.title}</span>
                    <span className="block text-xs text-muted">{note.body}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="hidden items-center gap-2 text-sm sm:flex">
            <UserRound size={16} />
            <span>{session?.name}</span>
          </div>
          <SignOutButton />
        </header>
        <div className="px-4 py-2 text-xs text-muted">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`}>
              {index > 0 ? " / " : ""}
              <span className="capitalize">{crumb.replaceAll("-", " ")}</span>
            </span>
          ))}
        </div>
        <main className="px-4 pb-10">{pathname ? null : null}</main>
      </div>
    </div>
  );
}

function SignOutButton() {
  const router = useRouter();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

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
      <Button type="button" size="sm" variant="ghost" aria-label="Sign out" onClick={() => setOpen(true)}>
        <LogOut size={16} />
      </Button>
      <Modal open={open} title="Sign out" onClose={() => { if (!pending) setOpen(false); }}>
        <p className="text-sm text-muted">Sign out of this account on this browser?</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" variant="primary" disabled={pending} onClick={() => void signOut()}>
            {pending ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>("light");
  useEffect(() => {
    const sync = () => setTheme(readTheme());
    sync();
    window.addEventListener("theme-change", sync);
    return () => window.removeEventListener("theme-change", sync);
  }, []);
  const next: ThemeChoice = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  return (
    <button className="rounded p-2 hover:bg-secondary" aria-label={`Theme ${theme}. Activate to switch.`} onClick={() => applyTheme(next)}>
      {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}

export function ShellFrame({ items, home, children }: { items: NavItem[]; home: string; children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login");
    else if (session.mustChangePassword) router.replace("/change-password");
  }, [loading, session, router]);
  if (loading) return <p className="p-6 text-sm text-muted">Loading workspace…</p>;
  if (!session) return null;
  return (
    <div className="min-h-screen md:grid md:grid-cols-[auto_1fr]">
      <ShellNav items={items} home={home} />
      <ShellMain home={home}>{children}</ShellMain>
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

function ShellNav({ items, home }: { items: NavItem[]; home: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("sidebar") === "collapsed") setCollapsed(true);
  }, []);
  return (
    <aside className={cn("border-b border-t-4 border-t-brand border-border bg-surface md:min-h-screen md:border-b-0 md:border-r", collapsed ? "md:w-20" : "md:w-60")}>
      <div className="flex h-14 items-center justify-between px-3">
        <Link href={home} aria-label="s7" className="flex items-center text-brand">
          <BrandMark className="h-9 w-9 object-contain" />
        </Link>
        <button className="hidden rounded p-1 hover:bg-secondary md:inline-flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((current) => { localStorage.setItem("sidebar", current ? "open" : "collapsed"); return !current; })}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <nav className="flex gap-1 overflow-auto px-2 pb-3 md:block" aria-label="Primary">
        {items.map((item, index) => {
          const active = pathname === item.href || (item.href !== home && pathname.startsWith(`${item.href}/`));
          const showMore = item.secondary && !items[index - 1]?.secondary;
          return (
            <div key={item.href}>
              {showMore ? <p className={cn("px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted", collapsed ? "md:sr-only" : "")}>More</p> : null}
              <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-2 rounded-md px-2 py-2 text-sm", active ? "bg-[var(--badge-info-bg)] font-semibold text-[var(--badge-info-fg)]" : "text-foreground hover:bg-secondary", item.secondary && !active ? "text-muted" : "")}>
                {item.icon}
                <span className={collapsed ? "md:sr-only" : ""}>{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function ShellMain({ children, home }: { children: React.ReactNode; home: string }) {
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
  return (
    <div className="min-w-0">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
        <div className="relative min-w-0 flex-1">
          <label className="relative block max-w-xl">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-2 top-2 text-muted" size={16} />
            <input className="h-8 w-full rounded-md border border-border bg-secondary pl-8 pr-3 text-sm" placeholder={home.startsWith("/vendor") ? "Search" : "Search a company or event"} value={query} onChange={(event) => { setQuery(event.target.value); setOpenSearch(true); }} onFocus={() => setOpenSearch(true)} />
          </label>
          {openSearch && query.trim().length > 1 ? (
            <div className="absolute z-30 mt-1 w-full max-w-xl rounded-md border border-border bg-surface p-1 shadow-panel">
              {(search.data?.data ?? []).map((item) => (
                <button key={`${item.type}-${item.id}`} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary" onClick={() => { setOpenSearch(false); router.push(item.type === "vendor" ? `/admin/vendors/${item.id}` : item.type === "form" ? `/admin/forms/${item.id}` : "/admin/exhibitions"); }}>
                  {item.label} <span className="text-muted">{item.hint}</span>
                </button>
              ))}
              {(search.data?.data ?? []).length === 0 ? <p className="px-2 py-2 text-sm text-muted">No matches</p> : null}
            </div>
          ) : null}
        </div>
        <ThemeToggle />
        <div className="relative">
          <button className="rounded p-2 hover:bg-secondary" aria-label="Notifications" aria-expanded={openNotes} onClick={() => setOpenNotes((value) => !value)}>
            <Bell size={18} />
          </button>
          {openNotes ? (
            <div className="absolute right-0 z-30 mt-1 w-80 rounded-md border border-border bg-surface p-2 shadow-panel">
              {(notifications.data?.data ?? []).length === 0 ? <p className="px-2 py-3 text-sm text-muted">Nothing new.</p> : null}
              {notifications.data?.data.map((note) => (
                <button key={note.id} className="block w-full rounded px-2 py-2 text-left hover:bg-secondary" onClick={async () => { await api(`/notifications/${note.id}/read`, { method: "POST" }); setOpenNotes(false); if (note.link.startsWith("/")) router.push(note.link); }}>
                  <span className="block text-sm font-medium">{note.title}</span>
                  <span className="line-clamp-2 text-xs text-muted">{note.body}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <span className="hidden text-sm sm:inline">{session?.name}</span>
        <SignOutButton />
      </header>
      <div className="px-4 pt-3 text-xs text-muted" aria-label="Breadcrumb">
        <Link href={home}>Home</Link>
        {crumbs.slice(1).map((crumb) => {
          const label = crumbLabel(crumb);
          if (!label) return null;
          return <span key={crumb}> / {label}</span>;
        })}
      </div>
      <main className="px-4 py-4">{children}</main>
    </div>
  );
}
