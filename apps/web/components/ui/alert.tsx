import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// iktva notice: faint tinted box, hairline border, a 2px coloured left edge for its kind.
const alertVariants = cva("relative w-full rounded-md border border-l-2 px-4 py-3 text-sm text-foreground [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-3 [&>svg]:top-3 [&>svg]:text-foreground [&>svg~*]:pl-7", {
  variants: {
    variant: {
      default: "border-[color-mix(in_srgb,var(--brand)_32%,transparent)] border-l-brand bg-[color-mix(in_srgb,var(--brand)_7%,transparent)]",
      destructive: "border-[color-mix(in_srgb,var(--danger)_45%,transparent)] border-l-danger bg-[color-mix(in_srgb,var(--danger)_7%,transparent)] [&>svg]:text-danger",
      warning: "border-[color-mix(in_srgb,var(--warning)_40%,transparent)] border-l-warning bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] [&>svg]:text-warning",
      success: "border-[color-mix(in_srgb,var(--success)_40%,transparent)] border-l-success bg-[color-mix(in_srgb,var(--success)_10%,transparent)] [&>svg]:text-success",
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
