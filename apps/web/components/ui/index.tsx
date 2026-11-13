"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Loader2, X } from "lucide-react";
import { usePublishFlag } from "@/components/flags";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { cn, formatLabel } from "@/lib/utils";

export { Button } from "@/components/ui/button";
export { Badge as ShadcnBadge, badgeVariants } from "@/components/ui/badge";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from "@/components/ui/table";
export { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
export { Input } from "@/components/ui/input";
export { Label } from "@/components/ui/label";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid min-w-0 content-start gap-1.5 text-sm">
      <span className="font-medium leading-5">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-5 text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass = "h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm leading-10 text-foreground placeholder:text-muted disabled:cursor-not-allowed disabled:bg-secondary disabled:text-foreground max-sm:h-11 max-sm:text-base max-sm:leading-[2.75rem]";
export const textareaClass = "min-h-28 w-full min-w-0 resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-sm leading-5 text-foreground placeholder:text-muted disabled:cursor-not-allowed disabled:bg-secondary disabled:text-foreground max-sm:text-base";

export function Badge({ tone, children }: { tone: "success" | "warning" | "danger" | "info" | "neutral"; children: React.ReactNode }) {
  return <ShadcnBadge variant={tone}>{children}</ShadcnBadge>;
}

export function UploadStatus({ pending }: { pending: boolean }) {
  if (!pending) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted" role="status">
      <Loader2 size={16} className="animate-spin" aria-hidden />
      Uploading…
    </span>
  );
}

export function UploadTick({ label = "Uploaded" }: { label?: string }) {
  return <Check size={16} className="shrink-0 text-[var(--success)]" aria-label={label} />;
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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#111111]/50 backdrop-blur-md" />
        <Dialog.Content className={cn("fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-4rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-[0_8px_16px_rgba(28,30,22,0.25),0_0_1px_rgba(28,30,22,0.31)]", wide ? "w-[min(960px,calc(100%-2rem))]" : "w-[min(560px,calc(100%-2rem))]")}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="min-w-0 flex-1 truncate text-lg font-semibold" title={title}>{title}</Dialog.Title>
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
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function Notice({ message, appearance = "success" }: { message?: string; appearance?: "success" | "information" | "warning" }) {
  usePublishFlag(message, appearance);
  return null;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-xl font-semibold leading-7 tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm leading-5 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
