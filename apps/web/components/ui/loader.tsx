"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

function CenterCard({
  label,
  description,
  size = "md",
}: {
  label: string;
  description?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="grid place-items-center gap-3 rounded-xl border border-border bg-surface px-8 py-7 shadow-panel">
      <Spinner size={size === "sm" ? "md" : "lg"} />
      <div className="grid gap-1 text-center">
        <p className="font-sans text-sm font-semibold text-foreground">{label}</p>
        {description ? <p className="max-w-xs text-center font-sans text-xs leading-5 text-muted">{description}</p> : null}
      </div>
    </div>
  );
}

/** Full-screen centered loader. Portaled to body so parent transforms cannot move it. */
function ScreenOverlay({
  label,
  description,
  className,
}: {
  label: string;
  description?: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const node = (
    <div
      className={cn(
        "pointer-events-auto fixed inset-0 z-[1000] flex items-center justify-center bg-[color-mix(in_srgb,var(--background)_72%,transparent)] p-4 backdrop-blur-[2px]",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <CenterCard label={label} description={description} size="lg" />
    </div>
  );

  // First paint uses fixed positioning; after mount, portal to body for reliable centering.
  if (!mounted || typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

export function LoadingState({
  label = "Loading…",
  description,
  className,
  size = "md",
  variant = "overlay",
}: {
  label?: string;
  description?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  /**
   * - overlay / page: centered full-screen loader (no layout shift)
   * - panel: local centered block for previews/cards
   * - inline: compact spinner + label for tight rows
   */
  variant?: "page" | "panel" | "inline" | "overlay";
}) {
  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-2 font-sans text-sm text-muted", className)} role="status" aria-live="polite">
        <Spinner size={size === "lg" ? "md" : size} />
        <span>{label}</span>
      </span>
    );
  }

  if (variant === "panel") {
    return (
      <div
        className={cn(
          "grid min-h-[12rem] place-items-center rounded-md border border-border bg-[color-mix(in_srgb,var(--surface-secondary)_55%,var(--surface))] px-4 py-10",
          className,
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <CenterCard label={label} description={description} size={size} />
      </div>
    );
  }

  // page + overlay → centered screen loader so page chrome/layout stay put
  return <ScreenOverlay label={label} description={description} className={className} />;
}
