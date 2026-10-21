import assert from "node:assert/strict";
import test from "node:test";
import { sniffAllowed } from "./scan";

test("accepts a PDF signature and rejects an executable renamed as pdf", () => {
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
  assert.equal(sniffAllowed(pdf, "booth.pdf", "application/pdf").clean, true);
  const exe = Buffer.from([0x4d, 0x5a, 0x00, 0x00]);
  assert.equal(sniffAllowed(exe, "booth.pdf", "application/pdf").clean, false);
});

test("accepts a glTF model and another extension, and rejects scripts", () => {
  const glb = Buffer.from("glTF............", "utf8");
  assert.equal(sniffAllowed(glb, "booth.glb", "application/octet-stream").clean, true);
  assert.equal(sniffAllowed(Buffer.from("v 0 0 0\nv 1 0 0\n"), "stand.obj", "text/plain").clean, true);
  assert.equal(sniffAllowed(Buffer.from("render notes"), "notes.blendinfo", "").clean, true);
  assert.equal(sniffAllowed(Buffer.from("<html>"), "page.html", "text/html").clean, false);
  assert.equal(sniffAllowed(Buffer.from([0x4d, 0x5a, 0x00, 0x00]), "booth.glb", "model/gltf-binary").clean, false);
});

test("rejects the EICAR test string and html disguised as text", () => {
  const eicar = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
  assert.equal(sniffAllowed(eicar, "note.txt", "text/plain").clean, false);
  assert.equal(sniffAllowed(Buffer.from("hello\0world"), "note.txt", "text/plain").clean, false);
  assert.equal(sniffAllowed(Buffer.from("<svg"), "logo.svg", "image/svg+xml").clean, false);
});
