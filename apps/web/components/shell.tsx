"use client";

import { Bell, ChevronLeft, ChevronRight, LogOut, Menu, Moon, Search, Sun, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSession } from "./providers";
import { Button } from "./ui";

export type NavItem = { href: string; label: string; icon: React.ReactNode };

export function AppShell({ items, home }: { items: NavItem[]; home: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const client = useQueryClient();
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

  async function signOut() {
    await api("/auth/logout", { method: "POST" });
    await client.invalidateQueries({ queryKey: ["me"] });
    router.push("/login");
  }

  const crumbs = pathname.split("/").filter(Boolean);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[auto_1fr]">
      <aside className={cn("border-b border-border bg-surface md:min-h-screen md:border-b-0 md:border-r", collapsed ? "md:w-16" : "md:w-60")}>
        <div className="flex h-14 items-center justify-between px-3">
          <Link href={home} className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded bg-brand text-xs text-[var(--brand-foreground)]">VP</span>
            {!collapsed ? <span>Vendor Portal</span> : null}
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
          <Button size="sm" variant="ghost" onClick={() => void signOut()} aria-label="Sign out">
            <LogOut size={16} />
          </Button>
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

function ThemeToggle() {
  const [theme, setTheme] = useState("system");
  useEffect(() => setTheme(localStorage.getItem("theme") || "system"), []);
  function apply(next: string) {
    localStorage.setItem("theme", next);
    const dark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }
  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  return (
    <button className="rounded p-2 hover:bg-secondary" aria-label={`Theme ${theme}. Activate to switch.`} onClick={() => apply(next)}>
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

function ShellNav({ items, home }: { items: NavItem[]; home: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("sidebar") === "collapsed") setCollapsed(true);
  }, []);
  return (
    <aside className={cn("border-b border-border bg-surface md:min-h-screen md:border-b-0 md:border-r", collapsed ? "md:w-16" : "md:w-60")}>
      <div className="flex h-14 items-center justify-between px-3">
        <Link href={home} className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded bg-brand text-xs text-[var(--brand-foreground)]">VP</span>
          {!collapsed ? <span>Vendor Portal</span> : null}
        </Link>
        <button className="hidden rounded p-1 hover:bg-secondary md:inline-flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((current) => { localStorage.setItem("sidebar", current ? "open" : "collapsed"); return !current; })}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <nav className="flex gap-1 overflow-auto px-2 pb-3 md:block" aria-label="Primary">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== home && pathname.startsWith(`${item.href}/`));
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-2 rounded-md px-2 py-2 text-sm", active ? "bg-[var(--badge-info-bg)] font-semibold text-[var(--badge-info-fg)]" : "text-foreground hover:bg-secondary")}>
              {item.icon}
              {collapsed ? <span className="sr-only md:not-sr-only md:hidden">{item.label}</span> : null}
              <span className={collapsed ? "md:sr-only" : ""}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function ShellMain({ children, home }: { children: React.ReactNode; home: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const client = useQueryClient();
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
            <input className="h-8 w-full rounded-md border border-border bg-secondary pl-8 pr-3 text-sm" placeholder="Search vendors, exhibitions, forms" value={query} onChange={(event) => { setQuery(event.target.value); setOpenSearch(true); }} onFocus={() => setOpenSearch(true)} />
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
        <Button size="sm" variant="ghost" aria-label="Sign out" onClick={async () => { await api("/auth/logout", { method: "POST" }); await client.invalidateQueries({ queryKey: ["me"] }); router.push("/login"); }}>
          <LogOut size={16} />
        </Button>
      </header>
      <div className="px-4 pt-3 text-xs text-muted" aria-label="Breadcrumb">
        <Link href={home}>Home</Link>
        {crumbs.slice(1).map((crumb) => (
          <span key={crumb}> / <span className="capitalize">{crumb.replaceAll("-", " ")}</span></span>
        ))}
      </div>
      <main className="px-4 py-4">{children}</main>
    </div>
  );
}
