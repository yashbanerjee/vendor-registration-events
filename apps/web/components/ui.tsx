"use client";

import { Slot } from "@radix-ui/react-slot";
import * as Dialog from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { usePublishFlag } from "@/components/flags";
import { cn, formatLabel } from "@/lib/utils";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand text-[var(--brand-foreground)] hover:opacity-90",
        secondary: "border border-border bg-surface text-foreground hover:bg-secondary",
        ghost: "text-foreground hover:bg-secondary",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        sm: "h-8 px-2.5",
        md: "h-9 px-3",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export function Button({ className, variant, size, asChild, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid min-w-0 content-start gap-1 text-sm">
      <span className="font-medium leading-5">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-4 text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass = "h-9 w-full min-w-0 rounded-md border border-border bg-surface px-3 py-0 text-sm leading-9 text-foreground placeholder:text-muted";

export function Badge({ tone, children }: { tone: "success" | "warning" | "danger" | "info" | "neutral"; children: React.ReactNode }) {
  const styles = {
    success: "bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]",
    warning: "bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]",
    danger: "bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]",
    info: "bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]",
    neutral: "bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]",
  };
  return <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold", styles[tone])}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{formatLabel(status)}</Badge>;
}

export function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "APPROVED" || status === "AVAILABLE" || status === "ACTIVE" || status === "SENT" || status === "DELIVERED") return "success";
  if (status.includes("PENDING") || status === "CORRECTION_REQUESTED" || status === "QUARANTINED" || status === "QUEUED") return "warning";
  if (status === "REJECTED" || status === "FAILED" || status === "BOUNCED") return "danger";
  if (status === "IN_PROGRESS" || status === "INVITED" || status === "PUBLISHED") return "info";
  return "neutral";
}

export function Modal({ open, title, onClose, wide, children }: { open: boolean; title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#111111]/50 backdrop-blur-md" />
        <Dialog.Content className={cn("fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-4rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-[0_8px_16px_rgba(28,30,22,0.25),0_0_1px_rgba(28,30,22,0.31)]", wide ? "w-[min(960px,calc(100%-2rem))]" : "w-[min(560px,calc(100%-2rem))]")}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="rounded p-1 hover:bg-secondary" aria-label="Close">
              <X size={16} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ message }: { message?: string }) {
  usePublishFlag(message, "error");
  return null;
}

export function Notice({ message, appearance = "success" }: { message?: string; appearance?: "success" | "information" | "warning" }) {
  usePublishFlag(message, appearance);
  return null;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
