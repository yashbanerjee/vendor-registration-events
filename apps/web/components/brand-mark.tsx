import { cn } from "@/lib/utils";

/** The parent site's lockup (white artwork). Only for dark surfaces. */
export const BRAND_LOGO = "/logo-iktva-forum.png";

export function BrandMark({ className, compact }: { className?: string; compact?: boolean }) {
  if (compact) {
    return (
      <span className={cn("inline-flex items-center justify-center", className)}>
        <img src="/logo-mark.png" alt="" className="h-full w-full object-contain dark:hidden" />
        <img src="/logo-mark-dark.png" alt="" className="hidden h-full w-full object-contain dark:block" />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center", className)}>
      <img src="/logo.png" alt="iktva Forum 2027" className="h-full w-auto max-w-full object-contain object-left dark:hidden" />
      <img src={BRAND_LOGO} alt="iktva Forum 2027" className="hidden h-full w-auto max-w-full object-contain object-left dark:block" />
    </span>
  );
}
