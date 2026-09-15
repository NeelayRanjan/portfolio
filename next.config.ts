import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // satellite.js's SGP4 propagation (lib/sky-iss.ts) is pure JS. Importing
  // the package on the client (NightSky's `import("satellite.js")`) hangs a
  // Turbopack production build indefinitely (never gets past "Creating an
  // optimized production build ..."; confirmed by bisecting with the route
  // and the import each in isolation) — Vercel's `next build` is Turbopack
  // too, so this bites there exactly the same way, not only locally. The
  // package's own optional WASM runtimes (createSingleThreadRuntime /
  // createMultiThreadRuntime, functions this site never calls) are reached
  // transitively from its main export via package-internal subpath imports
  // (`#wasm-single-thread` / `#wasm-multi-thread`, resolved through its own
  // package.json `imports` map) into Emscripten-generated glue that, for the
  // Node code path, does `await import("node:module")`; the pthreads variant
  // also self-references a Worker (`new Worker(new URL("index.js", ...),
  // { type: "module" })`) and `import("node:worker_threads")`. Bisecting
  // isolated the hang to importing satellite.js at all, not to which of
  // those two constructs Turbopack actually trips on — both are aliased so
  // neither is in play. The stub below is only reachable if something calls
  // createSingleThreadRuntime/createMultiThreadRuntime, which nothing here
  // does; it throws loudly if it's ever hit, rather than silently going
  // nowhere.
  // ⚠️ `#wasm-single-thread` / `#wasm-multi-thread` are satellite.js's
  // PACKAGE-PRIVATE import names, not a public API: a new release can rename
  // them, add a third, or change what reaches them, and these aliases would
  // then silently match nothing. That is why package.json pins satellite.js
  // to exactly 7.1.0. Whenever it is bumped, re-bisect the build hang (a
  // `next build` with the aliases removed, then with them) before trusting
  // these two lines.
  turbopack: {
    resolveAlias: {
      "#wasm-single-thread": "./lib/satellite-wasm-stub.js",
      "#wasm-multi-thread": "./lib/satellite-wasm-stub.js",
    },
  },
  async headers() {
    return [
      {
        // Cross-origin isolation, which is what unlocks SharedArrayBuffer and so
        // multi-threaded WASM. Without it onnxruntime-web is pinned to one thread
        // and a zero-shot classify takes ~17s instead of ~1s — measured, not
        // guessed. The site loads no cross-origin subresources (fonts are
        // self-hosted by next/font; the only external URLs are <a href> links,
        // which COEP doesn't touch), so this costs nothing here.
        //
        // If an external image, script or iframe is ever added it will need CORP
        // headers or crossorigin="anonymous", or it gets blocked outright.
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      {
        // Model and runtime are content-addressed by filename: a new model means
        // a new name, so these can be cached hard.
        source: "/models/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/ort/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // The headshot bundle: the two graphs, the meta, and the source crops.
        // Same deal as /models, and it carries the same obligation: these are
        // immutable by CONVENTION, not by content hash, so a retrained export
        // has to land under new filenames (meta included) or a returning
        // visitor keeps last year's weights.
        source: "/headshot/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
