import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", {
  variants: {
    variant: {
      default: "border-transparent bg-brand text-[var(--brand-foreground)]",
      secondary: "border-transparent bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]",
      destructive: "border-transparent bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]",
      outline: "border-border text-foreground",
      success: "border-transparent bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]",
      warning: "border-transparent bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]",
      danger: "border-transparent bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]",
      info: "border-transparent bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]",
      neutral: "border-transparent bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]",
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
