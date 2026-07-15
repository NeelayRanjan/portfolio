/**
 * Copies onnxruntime-web's wasm runtime into public/ort/.
 *
 * ORT fetches its wasm binary at runtime from `ort.env.wasm.wasmPaths`, so the
 * files have to be served, not bundled. Vendored rather than hotlinked from a
 * CDN, per the model handoff.
 *
 * WHICH BUILD: onnxruntime-web/webgpu (v1.27) requests the `asyncify` variant at
 * runtime — verified empirically, it 404s on anything else and the module loader
 * then rejects Next's HTML 404 page on MIME type, which surfaces as the opaque
 * "no available backend found". The plain `ort-wasm-simd-threaded.wasm` comes
 * along as the non-WebGPU fallback. Don't guess at this list: if ORT changes what
 * it fetches, the network tab names the file.
 *
 * Runs from `predev`/`prebuild` rather than being a one-time copy: the binary is
 * version-locked to the JS, so bumping onnxruntime-web without re-copying gives a
 * mismatch that only shows up as a runtime failure on first draw.
 */
import { copyFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "onnxruntime-web", "dist");
const to = join(root, "public", "ort");

const FILES = [
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
];

if (!existsSync(from)) {
  console.error("sync-ort: onnxruntime-web not installed; skipping");
  process.exit(0);
}
mkdirSync(to, { recursive: true });

let copied = 0;
for (const f of FILES) {
  const src = join(from, f);
  const dst = join(to, f);
  if (!existsSync(src)) {
    console.error(`sync-ort: missing ${f} — did onnxruntime-web change its layout?`);
    process.exit(1);
  }
  // Skip identical files so dev restarts don't re-copy 26MB every time.
  if (existsSync(dst) && statSync(dst).size === statSync(src).size) continue;
  copyFileSync(src, dst);
  copied++;
}
console.log(
  copied ? `sync-ort: copied ${copied} file(s) to public/ort/` : "sync-ort: up to date",
);
