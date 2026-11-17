"use client";

import { usePathname } from "next/navigation";
import { VendorFormShell } from "@/components/vendor-form-shell";
import { VendorPortalShell } from "@/components/vendor-portal-shell";

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const formOnly = pathname.startsWith("/vendor/assignments/");
  if (formOnly) return <VendorFormShell>{children}</VendorFormShell>;
  return <VendorPortalShell>{children}</VendorPortalShell>;
}
