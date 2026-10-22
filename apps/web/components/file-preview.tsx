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

function contentUrl(documentId: string, disposition: "inline" | "attachment") {
  return `/api/v1/documents/${documentId}/content?disposition=${disposition}`;
}

export function RemoteFileLink({ path, filename }: { path: string; filename: string }) {
  const [open, setOpen] = useState(false);
  const src = `/api/v1${path}${path.includes("?") ? "&" : "?"}disposition=inline`;
  return (
    <>
      <button type="button" className="font-semibold text-brand underline" onClick={() => setOpen(true)}>
        {filename}
      </button>
      <Modal open={open} title={filename} wide onClose={() => setOpen(false)}>
        {open ? <PreviewPane src={src} filename={filename} downloadHref={`/api/v1${path}?disposition=attachment`} /> : null}
      </Modal>
    </>
  );
}

function DocumentView({ documentId, filename, tall }: { documentId: string; filename: string; tall?: boolean }) {
  return <PreviewPane src={contentUrl(documentId, "inline")} filename={filename} tall={tall} downloadHref={contentUrl(documentId, "attachment")} />;
}

function PreviewPane({ src, filename, tall, downloadHref }: { src: string; filename: string; tall?: boolean; downloadHref: string }) {
  const kind = previewKind(filename);
  return (
    <div className="grid gap-2">
      {kind === "pdf" ? <PdfPages src={src} tall={tall} /> : null}
      {kind === "image" ? <ImageView src={src} alt={filename} /> : null}
      {kind === "video" ? <MediaView src={src} kind="video" tall={tall} /> : null}
      {kind === "audio" ? <MediaView src={src} kind="audio" /> : null}
      {kind === "model" ? <ModelView src={src} filename={filename} tall={tall} /> : null}
      {kind === "text" || kind === "other" ? <FileBody src={src} filename={filename} tall={tall} /> : null}
      <a className="text-sm underline" href={downloadHref}>
        Download
      </a>
    </div>
  );
}

async function loadFile(src: string) {
  const response = await fetch(src, { credentials: "include", cache: "no-store" });
  if (!response.ok) {
    const text = await response.text();
    let message = "The file could not be loaded.";
    try {
      const payload = JSON.parse(text) as { error?: { message?: string } };
      if (payload.error?.message) message = payload.error.message;
    } catch {
      if (text.trim()) message = "The file could not be loaded.";
    }
    throw new Error(message);
  }
  const type = response.headers.get("content-type")?.split(";")[0]?.trim() || "";
  const bytes = await response.arrayBuffer();
  return { bytes, type };
}

function ImageView({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    loadFile(src)
      .then(({ bytes, type }) => {
        if (cancelled) return;
        const mime = sniffedImageType(bytes, type);
        if (!mime) throw new Error("This image format cannot be shown in the browser.");
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
        setUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "This image could not be shown.");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  if (message) return <p className="text-sm text-muted">{message} Download it to open it on this device.</p>;
  if (!url) return <p className="text-sm text-muted">Loading image…</p>;
  return <img src={url} alt={alt} className="max-h-[32rem] w-full rounded-md border border-border bg-white object-contain" />;
}

function MediaView({ src, kind, tall }: { src: string; kind: "video" | "audio"; tall?: boolean }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    loadFile(src)
      .then(({ bytes, type }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: type || (kind === "video" ? "video/mp4" : "audio/mpeg") }));
        setUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "This file could not be played.");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [kind, src]);
  if (message) return <p className="text-sm text-muted">{message}</p>;
  if (!url) return <p className="text-sm text-muted">Loading file…</p>;
  if (kind === "audio") return <audio src={url} controls className="w-full" />;
  return <video src={url} controls className={`w-full rounded-md border border-border bg-black ${tall ? "max-h-[32rem]" : "max-h-[70dvh]"}`} />;
}

function FileBody({ src, filename, tall }: { src: string; filename: string; tall?: boolean }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"loading" | "text" | "binary" | "error">("loading");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadFile(src);
      const bytes = new Uint8Array(loaded.bytes);
      const sample = bytes.subarray(0, 8000);
      const binary = sample.includes(0);
      if (!cancelled && !binary && bytes.length <= 500_000) {
        setText(new TextDecoder().decode(bytes.subarray(0, 100_000)));
        setStatus("text");
        return;
      }
      if (!cancelled) setStatus("binary");
    })().catch((error: unknown) => {
      if (cancelled) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The file could not be shown.");
    });
    return () => {
      cancelled = true;
    };
  }, [src]);
  const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : "";
  return (
    <div>
      {status === "loading" ? <p className="text-sm text-muted">Loading file…</p> : null}
      <ErrorNote message={status === "error" ? message : ""} />
      {status === "text" ? <pre className={`overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-sm ${tall ? "max-h-[32rem]" : "max-h-[70dvh]"}`}>{text}</pre> : null}
      {status === "binary" ? <p className="text-sm text-muted">This {extension ? `.${extension} ` : ""}file is saved with the submission. Download it to open it in its own application.</p> : null}
    </div>
  );
}

function ModelView({ src, filename, tall }: { src: string; filename: string; tall?: boolean }) {
  const holder = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const node = holder.current;
    if (!node) return;
    let cancelled = false;
    let stop = () => {};
    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      const response = await fetch(src, { credentials: "include" });
      if (!response.ok) throw new Error("The model could not be loaded.");
      const buffer = await response.arrayBuffer();
      if (cancelled) return;
      const object = await loadModel(THREE, buffer, filename);
      if (cancelled) return;
      const width = node.clientWidth || 720;
      const height = node.clientHeight || (tall ? 420 : 560);
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.setClearColor(0xf1f2f4);
      node.replaceChildren(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const key = new THREE.DirectionalLight(0xffffff, 1.3);
      key.position.set(4, 6, 8);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.4);
      fill.position.set(-4, 2, -3);
      scene.add(fill);
      scene.add(object);
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      if (box.isEmpty()) object.position.set(0, 0, 0);
      else object.position.sub(center);
      const radius = Math.max(size.x, size.y, size.z, 0.1);
      camera.near = radius / 100;
      camera.far = radius * 100;
      camera.position.set(radius * 1.2, radius * 0.7, radius * 1.6);
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.update();
      let frame = 0;
      const draw = () => {
        frame = requestAnimationFrame(draw);
        controls.update();
        renderer.render(scene, camera);
      };
      draw();
      if (!cancelled) setStatus("ready");
      stop = () => {
        cancelAnimationFrame(frame);
        controls.dispose();
        renderer.dispose();
        if (node.isConnected) node.replaceChildren();
      };
    })().catch((error: unknown) => {
      if (cancelled) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The model could not be shown.");
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [filename, src, tall]);
  return (
    <div>
      {status === "loading" ? <p className="mb-2 text-sm text-muted">Loading model…</p> : null}
      <ErrorNote message={status === "error" ? message : ""} />
      {status === "error" ? <p className="mb-2 text-sm text-muted">This model could not be shown.</p> : null}
      {status === "ready" ? <p className="mb-2 text-xs text-muted">Drag to rotate. Scroll to zoom.</p> : null}
      <div ref={holder} className={`w-full overflow-hidden rounded-md border border-border bg-[#f1f2f4] ${tall ? "h-[26rem]" : "h-[70dvh]"}`} />
    </div>
  );
}

async function loadModel(THREE: any, buffer: ArrayBuffer, filename: string) {
  const extension = filename.toLowerCase().split(".").pop() ?? "";
  if (extension === "glb" || extension === "gltf") {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader().parseAsync(buffer, "");
    return gltf.scene;
  }
  if (extension === "obj") {
    const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
    return new OBJLoader().parse(new TextDecoder().decode(buffer));
  }
  if (extension === "stl") {
    const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
    const geometry = new STLLoader().parse(buffer);
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x8aa4c8, metalness: 0.15, roughness: 0.55 }));
  }
  if (extension === "ply") {
    const { PLYLoader } = await import("three/examples/jsm/loaders/PLYLoader.js");
    const geometry = new PLYLoader().parse(buffer);
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x8aa4c8, metalness: 0.15, roughness: 0.55 }));
  }
  if (extension === "fbx") {
    const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
    return new FBXLoader().parse(buffer, "");
  }
  if (extension === "dae") {
    const { ColladaLoader } = await import("three/examples/jsm/loaders/ColladaLoader.js");
    return new ColladaLoader().parse(new TextDecoder().decode(buffer), "").scene;
  }
  throw new Error("This 3D format cannot be shown in the browser.");
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
      const loaded = await loadFile(src);
      const data = new Uint8Array(loaded.bytes);
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

function sniffedImageType(bytes: ArrayBuffer, headerType: string) {
  const view = new Uint8Array(bytes);
  const declared = headerType.toLowerCase();
  if (declared === "image/heic" || declared === "image/heif" || declared === "image/avif") return "";
  if (view.length >= 3 && view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) return "image/jpeg";
  if (view.length >= 8 && view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47) return "image/png";
  if (view.length >= 6 && view[0] === 0x47 && view[1] === 0x49 && view[2] === 0x46) return "image/gif";
  if (view.length >= 12 && view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46 && view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50) return "image/webp";
  if (view.length >= 2 && view[0] === 0x42 && view[1] === 0x4d) return "image/bmp";
  if (declared.startsWith("image/") && declared !== "image/svg+xml") return declared;
  return "";
}

function previewKind(filename: string): "pdf" | "image" | "video" | "audio" | "model" | "text" | "other" {
  const extension = filename.toLowerCase().split(".").pop() ?? "";
  if (extension === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "jpe", "jfif", "gif", "webp", "bmp", "avif", "tif", "tiff", "heic"].includes(extension)) return "image";
  if (["mp4", "webm", "mov", "m4v", "ogv"].includes(extension)) return "video";
  if (["mp3", "wav", "ogg", "m4a"].includes(extension)) return "audio";
  if (["glb", "gltf", "obj", "stl", "ply", "fbx", "dae"].includes(extension)) return "model";
  if (["txt", "csv", "json", "md", "log", "xml"].includes(extension)) return "text";
  return "other";
}
