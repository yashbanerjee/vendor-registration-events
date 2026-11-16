import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full min-w-0 rounded-md border border-[var(--field-border)] bg-field px-3 text-sm text-foreground transition-[border-color,box-shadow] placeholder:text-dim focus:border-[#009ef0] focus:shadow-[0_0_0_3px_rgba(0,158,240,0.22)] focus:outline-none disabled:cursor-not-allowed disabled:bg-[var(--field-disabled)] disabled:text-muted max-sm:h-11 max-sm:text-base",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
