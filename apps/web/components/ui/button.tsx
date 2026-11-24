import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// iktva buttons: squared corners, bold capitals with wide tracking. Primary is solid blue, the rest are outlined.
const outlined = "border-[var(--field-border)] bg-transparent text-foreground hover:border-accent hover:bg-[var(--hover)]";
const solid = "border-[var(--primary-border)] bg-primary text-white hover:bg-[var(--primary-hover)] hover:shadow-[0_0_18px_rgba(0,158,240,0.45)]";
const danger = "border-[color-mix(in_srgb,var(--danger)_55%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger hover:bg-[color-mix(in_srgb,var(--danger)_22%,transparent)]";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent font-sans font-bold uppercase transition-[background-color,border-color,color,box-shadow,transform] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--ring)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: solid,
        primary: solid,
        destructive: danger,
        danger,
        outline: outlined,
        secondary: outlined,
        ghost: "text-foreground hover:bg-[var(--hover)]",
        link: "normal-case tracking-normal text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 text-[0.68rem] tracking-[0.1em] max-sm:px-3 max-sm:tracking-[0.06em]",
        md: "h-10 px-4 text-[0.68rem] tracking-[0.1em] max-sm:px-3 max-sm:tracking-[0.06em]",
        sm: "h-9 px-3 text-[0.64rem] tracking-[0.08em] max-sm:tracking-[0.05em] sm:h-8",
        lg: "h-11 px-5 text-[0.72rem] tracking-[0.12em] max-sm:px-4 max-sm:tracking-[0.06em]",
        // The big form buttons ("Save and continue").
        xl: "h-[52px] px-10 text-[0.8rem] tracking-[0.16em]",
        icon: "h-10 w-10",
      },
    },
    compoundVariants: [
      { variant: ["default", "primary"], size: "xl", className: "shadow-[0_14px_30px_rgba(0,100,173,0.35)] hover:-translate-y-px hover:shadow-[0_0_22px_rgba(0,158,240,0.5),0_14px_30px_rgba(0,100,173,0.35)]" },
    ],
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
