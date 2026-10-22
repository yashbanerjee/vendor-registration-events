import net from "node:net";

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export type ScanResult = { clean: boolean; details: string };

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  jfif: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  avif: "image/avif",
  heic: "image/heic",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  obj: "model/obj",
  stl: "model/stl",
  ply: "model/ply",
  fbx: "application/octet-stream",
  dae: "model/vnd.collada+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  zip: "application/zip",
};

const BLOCKED_EXTENSIONS = new Set([
  "exe", "dll", "bat", "cmd", "com", "msi", "scr", "ps1", "sh", "bash", "js", "mjs", "cjs",
  "html", "htm", "svg", "xhtml", "php", "jar", "vbs", "wsf", "apk", "hta", "cpl", "lnk",
  "reg", "wasm", "dmg", "iso", "app", "deb", "rpm", "so", "dylib",
]);

export function isPreviewableMime(mimeType: string) {
  if (mimeType === "application/pdf" || mimeType === "application/json") return true;
  if (mimeType.startsWith("text/") || mimeType.startsWith("video/") || mimeType.startsWith("audio/") || mimeType.startsWith("model/")) return true;
  return mimeType.startsWith("image/") && mimeType !== "image/svg+xml";
}

export function mimeForFilename(filename: string, declaredMime = "") {
  const extension = extensionOf(filename);
  return MIME_BY_EXTENSION[extension] ?? (declaredMime && declaredMime !== "application/octet-stream" ? declaredMime : "application/octet-stream");
}

export function sniffAllowed(buffer: Buffer, filename: string, declaredMime: string): ScanResult {
  const extension = extensionOf(filename);
  if (!extension || BLOCKED_EXTENSIONS.has(extension)) return { clean: false, details: "This file type is not allowed." };
  const expected = MIME_BY_EXTENSION[extension];
  const declared = normalizeMime(declaredMime);
  if (expected && declared && declared !== "application/octet-stream" && declared !== expected && !compatibleMime(declared, expected)) {
    return { clean: false, details: "The file extension does not match its content type." };
  }
  if (buffer.includes(Buffer.from(EICAR))) return { clean: false, details: "Malware signature detected." };
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) return { clean: false, details: "Executable content is not allowed." };
  if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return { clean: false, details: "Executable content is not allowed." };
  }
  if (!magicMatches(buffer, extension)) return { clean: false, details: "File content does not match its extension." };
  return { clean: true, details: "signature checks passed" };
}

function extensionOf(filename: string) {
  const base = filename.toLowerCase().split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1) : "";
}

function normalizeMime(mime: string) {
  const value = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  const aliases: Record<string, string> = {
    "image/jpg": "image/jpeg",
    "image/pjpeg": "image/jpeg",
    "image/x-citrix-jpeg": "image/jpeg",
    "application/jpg": "image/jpeg",
    "image/x-png": "image/png",
    "image/x-citrix-png": "image/png",
    "image/tif": "image/tiff",
    "image/x-tiff": "image/tiff",
  };
  return aliases[value] ?? value;
}

function compatibleMime(declared: string, expected: string) {
  if (expected === "application/octet-stream") return true;
  if (expected.startsWith("model/") && (declared.startsWith("model/") || declared.startsWith("text/") || declared === "application/json" || declared === "application/xml" || declared === "text/xml")) return true;
  if ((expected === "text/plain" || expected === "text/csv" || expected === "application/json") && declared.startsWith("text/")) return true;
  return false;
}

function magicMatches(buffer: Buffer, extension: string): boolean {
  const starts = (...bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte);
  if (extension === "pdf") return buffer.subarray(0, 4).toString("utf8") === "%PDF";
  if (extension === "png") return starts(0x89, 0x50, 0x4e, 0x47);
  if (extension === "jpg" || extension === "jpeg" || extension === "jpe" || extension === "jfif") return starts(0xff, 0xd8, 0xff);
  if (extension === "gif") return buffer.subarray(0, 6).toString("utf8") === "GIF87a" || buffer.subarray(0, 6).toString("utf8") === "GIF89a";
  if (extension === "webp") return buffer.subarray(0, 4).toString("utf8") === "RIFF" && buffer.subarray(8, 12).toString("utf8") === "WEBP";
  if (extension === "docx" || extension === "xlsx" || extension === "zip") return starts(0x50, 0x4b, 0x03, 0x04);
  if (extension === "txt" || extension === "csv" || extension === "json" || extension === "obj" || extension === "dae") return !buffer.includes(0);
  if (extension === "gltf") return !buffer.includes(0) && buffer.subarray(0, 400).toString("utf8").trim().startsWith("{");
  if (extension === "glb") return buffer.subarray(0, 4).toString("utf8") === "glTF";
  if (extension === "stl") return buffer.subarray(0, 5).toString("utf8") === "solid" || stlBinary(buffer);
  if (extension === "ply") return buffer.subarray(0, 3).toString("utf8") === "ply";
  if (extension === "fbx") return buffer.subarray(0, 18).toString("utf8").startsWith("Kaydara FBX Binary") || buffer.subarray(0, 20).toString("utf8").includes("FBX");
  if (extension === "bmp") return buffer.subarray(0, 2).toString("utf8") === "BM";
  if (extension === "tif" || extension === "tiff") return starts(0x49, 0x49, 0x2a, 0x00) || starts(0x4d, 0x4d, 0x00, 0x2a);
  if (extension === "mp4" || extension === "mov" || extension === "avif" || extension === "heic") return buffer.subarray(4, 8).toString("utf8") === "ftyp";
  if (extension === "webm") return starts(0x1a, 0x45, 0xdf, 0xa3);
  if (extension === "wav") return buffer.subarray(0, 4).toString("utf8") === "RIFF" && buffer.subarray(8, 12).toString("utf8") === "WAVE";
  if (extension === "mp3") return buffer.subarray(0, 3).toString("utf8") === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  if (MIME_BY_EXTENSION[extension]) return false;
  return true;
}

function stlBinary(buffer: Buffer) {
  if (buffer.length < 84) return false;
  const triangles = buffer.readUInt32LE(80);
  return buffer.length === 84 + triangles * 50;
}

export async function scanWithClamAv(buffer: Buffer, host: string, port: number): Promise<ScanResult> {
  if (!host) return { clean: true, details: "clamav not configured" };
  const response = await new Promise<string>((resolve, reject) => {
    const socket = net.connect({ host, port });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Malware scanner timed out."));
    }, 15_000);
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.on("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    socket.write("zINSTREAM\0");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(buffer.length, 0);
    socket.write(length);
    socket.write(buffer);
    const end = Buffer.alloc(4);
    socket.write(end);
    socket.end();
  });
  if (response.includes("FOUND")) return { clean: false, details: "Malware scanner rejected the file." };
  if (!response.includes("OK")) return { clean: false, details: "Malware scanner returned an unexpected result." };
  return { clean: true, details: "clamav clean" };
}

export async function scanBuffer(buffer: Buffer, filename: string, declaredMime: string, clam?: { host: string; port: number }) {
  const signature = sniffAllowed(buffer, filename, declaredMime);
  if (!signature.clean) return signature;
  if (clam?.host) {
    const external = await scanWithClamAv(buffer, clam.host, clam.port);
    if (!external.clean) return external;
    return { clean: true, details: `${signature.details}; ${external.details}` };
  }
  return signature;
}
