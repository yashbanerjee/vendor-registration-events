"use client";

import { useEffect, useRef, useState } from "react";
import { ErrorNote, Modal } from "./ui";

export function FileLink({ documentId, filename }: { documentId: string; filename: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="underline" onClick={() => setOpen(true)}>
        {filename}
      </button>
      <FilePreview open={open} documentId={documentId} filename={filename} onClose={() => setOpen(false)} />
    </>
  );
}

export function InlineFilePreview({ documentId, filename }: { documentId: string; filename: string }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{filename}</p>
      <DocumentView documentId={documentId} filename={filename} tall />
    </div>
  );
}

function FilePreview({ open, documentId, filename, onClose }: { open: boolean; documentId: string; filename: string; onClose: () => void }) {
  return (
    <Modal open={open} title={filename} wide onClose={onClose}>
      {open ? <DocumentView documentId={documentId} filename={filename} /> : null}
    </Modal>
  );
}

function DocumentView({ documentId, filename, tall }: { documentId: string; filename: string; tall?: boolean }) {
  const kind = previewKind(filename, typeFromName(filename));
  const src = `/api/v1/documents/${documentId}/content/${encodeURIComponent(filename)}?disposition=inline`;
  return (
    <div className="grid gap-2">
      {kind === "pdf" ? <PdfPages src={src} tall={tall} /> : null}
      {kind === "image" ? <img src={src} alt={filename} className="max-h-[32rem] w-full rounded-md border border-border bg-white object-contain" /> : null}
      {kind === "other" ? <p className="text-sm text-muted">This file type cannot be shown in the page. Download it to open it on this device.</p> : null}
      <a className="text-sm underline" href={`/api/v1/documents/${documentId}/content/${encodeURIComponent(filename)}?disposition=attachment`}>
        Download
      </a>
    </div>
  );
}

function PdfPages({ src, tall }: { src: string; tall?: boolean }) {
  const holder = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const response = await fetch(src, { credentials: "include" });
      if (!response.ok) throw new Error("The document could not be loaded.");
      const data = new Uint8Array(await response.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data }).promise;
      destroy = () => {
        void pdf.destroy();
      };
      if (cancelled || !holder.current) return;
      holder.current.replaceChildren();
      const width = holder.current.clientWidth || 720;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (cancelled || !holder.current) return;
        const page = await pdf.getPage(pageNumber);
        const unscaled = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(2, width / unscaled.width) });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = "h-auto w-full bg-white shadow-sm";
        const context = canvas.getContext("2d");
        if (!context) throw new Error("The document could not be drawn.");
        await page.render({ canvasContext: context, viewport }).promise;
        holder.current.appendChild(canvas);
      }
      if (!cancelled) setStatus("ready");
    })().catch((error: unknown) => {
      if (cancelled) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The document could not be shown.");
    });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [src]);

  return (
    <div className={`overflow-auto rounded-md border border-border bg-slate-100 p-3 ${tall ? "max-h-[32rem]" : "max-h-[70dvh]"}`}>
      {status === "loading" ? <p className="text-sm text-muted">Loading document…</p> : null}
      <ErrorNote message={status === "error" ? message : ""} />
      {status === "error" ? <p className="text-sm text-muted">This document could not be shown.</p> : null}
      <div ref={holder} className="grid gap-3" />
    </div>
  );
}

function previewKind(filename: string, mime: string): "pdf" | "image" | "other" {
  if (mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) return "pdf";
  if ((mime.startsWith("image/") && mime !== "image/svg+xml") || /\.(png|jpe?g|gif|webp)$/i.test(filename)) return "image";
  return "other";
}

function typeFromName(filename: string) {
  const name = filename.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".webp")) return "image/webp";
  return "";
}
