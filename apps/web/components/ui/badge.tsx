import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Status chip: squared, capitals, tinted fill with a border in the same colour.
const tinted = "border-[color-mix(in_srgb,currentColor_45%,transparent)]";

const badgeVariants = cva("inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase leading-4 tracking-[0.1em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", {
  variants: {
    variant: {
      default: "border-[var(--primary-border)] bg-primary text-white",
      secondary: `${tinted} bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]`,
      destructive: `${tinted} bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]`,
      outline: "border-border text-foreground",
      success: `${tinted} bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]`,
      warning: `${tinted} bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]`,
      danger: `${tinted} bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]`,
      info: `${tinted} bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]`,
      neutral: `${tinted} bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]`,
    },
  },
  defaultVariants: {
    variant: "secondary",
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
