import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
