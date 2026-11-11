"use client";

import { ClipboardList, FileText } from "lucide-react";
import { usePathname } from "next/navigation";
import { ShellFrame } from "@/components/shell";
import { VendorFormShell } from "@/components/vendor-form-shell";

const items = [
  { href: "/vendor", label: "My form", icon: <ClipboardList size={16} /> },
  { href: "/vendor/documents", label: "My files", icon: <FileText size={16} /> },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const formOnly = pathname.startsWith("/vendor/assignments/");
  if (formOnly) return <VendorFormShell>{children}</VendorFormShell>;
  return <ShellFrame items={items} home="/vendor">{children}</ShellFrame>;
}
