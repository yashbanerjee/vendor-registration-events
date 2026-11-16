import { cn } from "@/lib/utils";

export function Spinner({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-10 w-10" : "h-7 w-7";
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", dim, className)} role="status" aria-hidden>
      <span className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] animate-pulse" />
      <span className={cn("absolute inset-0 rounded-full border-2 border-transparent border-t-brand border-r-[color-mix(in_srgb,var(--brand)_35%,transparent)] animate-spin", dim)} />
      <span className="absolute h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_10px_var(--brand)]" />
    </span>
  );
}

export function LoadingState({
  label = "Loading…",
  description,
  className,
  size = "md",
  variant = "page",
}: {
  label?: string;
  description?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "page" | "panel" | "inline" | "overlay";
}) {
  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-2 text-sm text-muted", className)} role="status" aria-live="polite">
        <Spinner size={size === "lg" ? "md" : size} />
        <span>{label}</span>
      </span>
    );
  }

  if (variant === "overlay") {
    return (
      <div className={cn("fixed inset-0 z-[60] grid place-items-center bg-[color-mix(in_srgb,var(--background)_72%,transparent)] backdrop-blur-[2px]", className)} role="status" aria-live="polite" aria-busy="true">
        <div className="grid place-items-center gap-3 rounded-xl border border-border bg-surface px-8 py-7 shadow-panel">
          <Spinner size="lg" />
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {description ? <p className="max-w-xs text-center text-xs leading-5 text-muted">{description}</p> : null}
        </div>
      </div>
    );
  }

  const shell =
    variant === "panel"
      ? "grid min-h-[12rem] place-items-center rounded-md border border-border bg-[color-mix(in_srgb,var(--surface-secondary)_55%,var(--surface))] px-4 py-10"
      : "grid min-h-[14rem] place-items-center px-4 py-12";

  return (
    <div className={cn(shell, className)} role="status" aria-live="polite" aria-busy="true">
      <div className="grid place-items-center gap-3">
        <Spinner size={size === "sm" ? "md" : "lg"} />
        <div className="grid gap-1 text-center">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {description ? <p className="max-w-sm text-xs leading-5 text-muted">{description}</p> : null}
        </div>
        <div className="mt-1 flex items-center gap-1.5" aria-hidden>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.1s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" />
        </div>
      </div>
    </div>
  );
}
