"use client";

import { ClipboardCheck, Files, LayoutDashboard, ScrollText, Settings, Store, Tags, Tickets, Workflow } from "lucide-react";
import { ShellFrame } from "@/components/shell";

const items = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { href: "/admin/vendors", label: "Vendors", icon: <Store size={16} /> },
  { href: "/admin/categories", label: "Categories", icon: <Tags size={16} /> },
  { href: "/admin/exhibitions", label: "Exhibitions", icon: <Tickets size={16} /> },
  { href: "/admin/forms", label: "Forms", icon: <Workflow size={16} /> },
  { href: "/admin/reviews", label: "Reviews", icon: <ClipboardCheck size={16} /> },
  { href: "/admin/documents", label: "Documents", icon: <Files size={16} /> },
  { href: "/admin/audit", label: "Audit", icon: <ScrollText size={16} /> },
  { href: "/admin/jobs", label: "Jobs", icon: <ScrollText size={16} /> },
  { href: "/admin/settings", label: "Settings", icon: <Settings size={16} /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ShellFrame items={items} home="/admin">{children}</ShellFrame>;
}
