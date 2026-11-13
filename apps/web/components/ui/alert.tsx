import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("relative w-full rounded-md border px-3 py-2.5 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-3 [&>svg]:top-3 [&>svg]:text-foreground [&>svg~*]:pl-7", {
  variants: {
    variant: {
      default: "border-border bg-surface text-foreground",
      destructive: "border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)] [&>svg]:text-[var(--badge-danger-fg)]",
      warning: "border-[color-mix(in_srgb,var(--warning)_28%,transparent)] bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)] [&>svg]:text-[var(--badge-warning-fg)]",
      success: "border-[color-mix(in_srgb,var(--success)_28%,transparent)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)] [&>svg]:text-[var(--badge-success-fg)]",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm leading-5 [&_p]:leading-relaxed", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
