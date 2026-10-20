import net from "node:net";

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export type ScanResult = { clean: boolean; details: string };

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function sniffAllowed(buffer: Buffer, filename: string, declaredMime: string): ScanResult {
  const extension = filename.toLowerCase().split(".").pop() ?? "";
  const expected = MIME_BY_EXTENSION[extension];
  if (!expected) return { clean: false, details: "This file type is not allowed." };
  if (declaredMime && declaredMime !== "application/octet-stream" && declaredMime !== expected) {
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

function magicMatches(buffer: Buffer, extension: string): boolean {
  const starts = (...bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte);
  if (extension === "pdf") return buffer.subarray(0, 4).toString("utf8") === "%PDF";
  if (extension === "png") return starts(0x89, 0x50, 0x4e, 0x47);
  if (extension === "jpg" || extension === "jpeg") return starts(0xff, 0xd8, 0xff);
  if (extension === "gif") return buffer.subarray(0, 6).toString("utf8") === "GIF87a" || buffer.subarray(0, 6).toString("utf8") === "GIF89a";
  if (extension === "webp") return buffer.subarray(0, 4).toString("utf8") === "RIFF" && buffer.subarray(8, 12).toString("utf8") === "WEBP";
  if (extension === "docx" || extension === "xlsx") return starts(0x50, 0x4b, 0x03, 0x04);
  if (extension === "txt" || extension === "csv") return !buffer.includes(0);
  return false;
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
