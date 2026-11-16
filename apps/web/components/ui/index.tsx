"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import { usePublishFlag } from "@/components/flags";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loader";
import { cn, formatLabel } from "@/lib/utils";

export { Button } from "@/components/ui/button";
export { Badge as ShadcnBadge, badgeVariants } from "@/components/ui/badge";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from "@/components/ui/table";
export { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
export { Input } from "@/components/ui/input";
export { Label } from "@/components/ui/label";
export { LoadingState, Spinner } from "@/components/ui/loader";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid min-w-0 content-start gap-1.5 text-sm">
      <span className="font-medium leading-5">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-5 text-muted">{hint}</span> : null}
    </label>
  );
}

const controlClass = "w-full min-w-0 rounded-md border border-[var(--field-border)] bg-field text-foreground transition-[border-color,box-shadow] placeholder:text-dim focus:border-[#009ef0] focus:shadow-[0_0_0_3px_rgba(0,158,240,0.22)] focus:outline-none disabled:cursor-not-allowed disabled:bg-[var(--field-disabled)] disabled:text-muted";
export const inputClass = `h-10 px-3 text-sm leading-10 max-sm:h-11 max-sm:text-base max-sm:leading-[2.75rem] ${controlClass}`;
export const textareaClass = `min-h-28 resize-y px-3 py-2.5 text-sm leading-5 max-sm:text-base ${controlClass}`;

export function Badge({ tone, children }: { tone: "success" | "warning" | "danger" | "info" | "neutral"; children: React.ReactNode }) {
  return <ShadcnBadge variant={tone}>{children}</ShadcnBadge>;
}

export function UploadStatus({ pending }: { pending: boolean }) {
  if (!pending) return null;
  return <LoadingState variant="inline" size="sm" label="Uploading…" />;
}

export function UploadTick({ label = "Uploaded" }: { label?: string }) {
  return (
    <span
      className="inline-flex size-5 shrink-0 items-center justify-center rounded border-2 border-[var(--success)] bg-[var(--badge-success-bg)] text-[var(--success)]"
      aria-label={label}
      title={label}
    >
      <Check size={14} strokeWidth={3} aria-hidden />
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{formatLabel(status)}</Badge>;
}

export function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "APPROVED" || status === "AVAILABLE" || status === "ACTIVE" || status === "SENT" || status === "DELIVERED" || status === "SUBMITTED") return "success";
  if (status.includes("PENDING") || status === "CORRECTION_REQUESTED" || status === "QUARANTINED" || status === "QUEUED" || status === "REUPLOAD") return "warning";
  if (status === "REJECTED" || status === "FAILED" || status === "BOUNCED") return "danger";
  if (status === "IN_PROGRESS" || status === "INVITED" || status === "PUBLISHED") return "info";
  return "neutral";
}

export function Modal({ open, title, onClose, wide, children }: { open: boolean; title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#0a0c0e]/70 backdrop-blur-md" />
        <Dialog.Content className={cn("fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-lg border border-[var(--field-border)] border-t-2 border-t-brand bg-surface p-4 shadow-panel sm:max-h-[calc(100dvh-4rem)] sm:p-5", wide ? "w-[min(960px,calc(100%-1.5rem))]" : "w-[min(560px,calc(100%-1.5rem))]")}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="min-w-0 flex-1 truncate text-base font-bold uppercase leading-7 tracking-[0.06em] text-[var(--heading)]" title={title}>{title}</Dialog.Title>
            <Dialog.Close className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-secondary sm:h-8 sm:w-8" aria-label="Close">
              <X size={16} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Button row at the foot of a dialog: equal halves on a phone, right-aligned from tablet up. */
export function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 grid grid-cols-2 gap-2 sm:flex sm:justify-end">{children}</div>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--field-border)] bg-[var(--tint)] px-5 py-10 text-center">
      <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--heading)]">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Summary tile. Every dashboard uses this so the tiles are the same size everywhere. */
export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="panel flex min-w-0 flex-col px-3.5 py-3.5 sm:px-4 sm:py-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 text-2xl font-bold leading-8 tracking-tight text-[var(--heading)] sm:text-3xl sm:leading-9">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{children}</div>;
}

export function ErrorNote({ message, className }: { message?: string; className?: string }) {
  usePublishFlag(message, "error");
  if (!message) return null;
  return (
    <Alert variant="destructive" className={className}>
      <AlertDescription className="break-words">{message}</AlertDescription>
    </Alert>
  );
}

export function Notice({ message, appearance = "success" }: { message?: string; appearance?: "success" | "information" | "warning" }) {
  usePublishFlag(message, appearance);
  return null;
}

export function PageHeader({ title, description, eyebrow, actions }: { title: string; description?: string; eyebrow?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 sm:mb-5">
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="break-words text-xl font-bold uppercase leading-7 tracking-[0.02em] text-[var(--heading)]">{title}</h1>
        <span className="brand-rule mt-2" aria-hidden />
        {description ? <p className="mt-2.5 break-words text-sm leading-5 text-muted">{description}</p> : null}
      </div>
      {/* Phones give actions their own full-width row under the title so every page lines up the same way. */}
      {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:max-w-full">{actions}</div> : null}
    </div>
  );
}

/** Search and filter row: a two-column grid on a phone so every control lines up, inline from tablet up. */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center", className)}>{children}</div>;
}
