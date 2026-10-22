"use client";

import { ClipboardCheck, ClipboardList, Files, History, LayoutDashboard, Mail, Settings, Store, Tags, Tickets, Workflow } from "lucide-react";
import { ShellFrame } from "@/components/shell";

const items = [
  { href: "/admin", label: "Home", icon: <LayoutDashboard size={16} /> },
  { href: "/admin/exhibitions", label: "Events", icon: <Tickets size={16} /> },
  { href: "/admin/vendors", label: "Companies", icon: <Store size={16} /> },
  { href: "/admin/forms", label: "Forms", icon: <Workflow size={16} /> },
  { href: "/admin/reviews", label: "Check answers", icon: <ClipboardCheck size={16} /> },
  { href: "/admin/documents", label: "Files", icon: <Files size={16} />, secondary: true },
  { href: "/admin/categories", label: "Categories", icon: <Tags size={16} />, secondary: true },
  { href: "/admin/submissions", label: "All answers", icon: <ClipboardList size={16} />, secondary: true },
  { href: "/admin/jobs", label: "Emails", icon: <Mail size={16} />, secondary: true },
  { href: "/admin/audit", label: "History", icon: <History size={16} />, secondary: true },
  { href: "/admin/settings", label: "Settings", icon: <Settings size={16} />, secondary: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ShellFrame items={items} home="/admin">{children}</ShellFrame>;
}
