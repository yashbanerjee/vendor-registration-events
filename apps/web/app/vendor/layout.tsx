"use client";

import { ClipboardList, FileText } from "lucide-react";
import { ShellFrame } from "@/components/shell";

const items = [
  { href: "/vendor", label: "My form", icon: <ClipboardList size={16} /> },
  { href: "/vendor/documents", label: "My files", icon: <FileText size={16} /> },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return <ShellFrame items={items} home="/vendor">{children}</ShellFrame>;
}
