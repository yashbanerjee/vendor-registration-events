"use client";

import { FileText, LayoutDashboard } from "lucide-react";
import { ShellFrame } from "@/components/shell";

const items = [
  { href: "/vendor", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { href: "/vendor/documents", label: "Documents", icon: <FileText size={16} /> },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return <ShellFrame items={items} home="/vendor">{children}</ShellFrame>;
}
