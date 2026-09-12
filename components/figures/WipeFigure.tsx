"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { copy } from "@/content/copy";

/** Fallbacks in case the tokens can't be read live (SSR, or a stripped style). */
const FALLBACK = {
  "--color-ok": { r: 0x63, g: 0xc6, b: 0x8c },
  "--color-red-ink": { r: 0xe5, g: 0x35, b: 0x2b },
} as const;

type Rgb = { r: number; g: number; b: number };

function readToken(name: keyof typeof FALLBACK): Rgb {
  if (typeof document === "undefined") return FALLBACK[name];
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const match = /^#([0-9a-f]{6})$/i.exec(raw);
  if (!match) return FALLBACK[name];
  const hex = match[1];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/**
 * Recolor a binary mask PNG onto a canvas: vessel pixels become `tint` at
 * full alpha, background pixels become fully transparent.
 *
 * Canvas pixel-recoloring, NOT CSS mask-image: mask-image computes correctly
 * but silently fails to paint in this repo's headless Firefox (verified in
 * Task 6 — same family as the documented `omitBackground` gap), so both
 * layers go through this one code path.
 *
 * ⚠️ Polarity is DETECTED, not assumed. The exported masks do not share a
 * convention: image 189's SAM mask was black-vessel-on-white while image
 * 330's is white-vessel-on-black (measured: white fractions 0.109 and 0.151
 * for 330's pair). Hardcoding the polarity painted the entire background
 * red on the first swap. Vessels are always the minority class in these
 * angiograms, so the side with fewer pixels is the vessel.
 */
function paintMask(canvas: HTMLCanvasElement, src: string, tint: Rgb) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = new Image();
  img.onload = () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = frame.data;
    let white = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i] > 127) white++;
    const vesselIsWhite = white < px.length / 8; // minority side is the vessel
    for (let i = 0; i < px.length; i += 4) {
      const on = vesselIsWhite ? px[i] > 127 : px[i] < 127;
      px[i] = tint.r;
      px[i + 1] = tint.g;
      px[i + 2] = tint.b;
      px[i + 3] = on ? 255 : 0;
    }
    ctx.putImageData(frame, 0, 0);
  };
  img.src = src;
}

/**
 * Figure 1 — the wipe: a real angiogram (image 330 from the pelvic-iliac
 * benchmark, see public/research/provenance.json) with two real segmentation
 * masks laid over it, dragged into comparison.
 *
 * Colors are the owner's call (2026-09-12): GREEN is x0-diffusion, RED is
 * SAM — an explicit override of the spec-era "red marks the x0 finding" rule
 * for this figure. The on-image legend and the caption both carry the
 * mapping in words, so color is never the only carrier.
 *
 * Layer order, bottom to top, all filling the same box:
 * 1. `angiogram.webp` — the base image.
 * 2. SAM's mask, red, always fully visible.
 * 3. x0-diffusion's mask, green, clipped by the wipe: at the default
 *    `--cut: 50%` the box reads half red (left, SAM alone) and half green
 *    (right, x0 painted over SAM).
 *
 * `clip-path: inset(0 0 0 var(--cut))` wipes the x0 canvas from the left;
 * "cut" is how much of the overlay has been cut away.
 */
export function WipeFigure() {
  const [cut, setCut] = useState(50);
  const samRef = useRef<HTMLCanvasElement>(null);
  const x0Ref = useRef<HTMLCanvasElement>(null);
  const t = copy.research.figWipe;

  useEffect(() => {
    if (samRef.current) {
      paintMask(samRef.current, "/research/mask_sam.png", readToken("--color-red-ink"));
    }
    if (x0Ref.current) {
      paintMask(x0Ref.current, "/research/mask_x0.png", readToken("--color-ok"));
    }
  }, []);

  const clipStyle = {
    "--cut": `${cut}%`,
    clipPath: "inset(0 0 0 var(--cut))",
  } as CSSProperties;

  return (
    <InstrumentFigure n="1" caption={t.caption} readout={`${t.cutLabel} ${cut}%`}>
      <div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden border border-rule bg-panel">
        <img
          src="/research/angiogram.webp"
          alt={t.angiogramAlt}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <canvas
          ref={samRef}
          aria-hidden
          className="absolute inset-0 h-full w-full"
        />
        <canvas
          ref={x0Ref}
          aria-hidden
          className="absolute inset-0 h-full w-full"
          style={clipStyle}
        />
        <div
          aria-hidden
          className="absolute top-0 bottom-0 w-px bg-ink/70"
          style={{ left: `${cut}%` }}
        />
        {/* The legend is real text, not aria-hidden: it is the one place the
            color-to-model mapping is stated on the image itself. */}
        <div className="absolute bottom-2 left-2 flex flex-col gap-1 bg-[rgba(18,17,15,0.78)] px-2 py-1.5 font-mono text-[10px] leading-tight text-ink">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2 bg-ok" />
            {t.legendX0}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2 bg-red-ink" />
            {t.legendSam}
          </span>
        </div>
      </div>
      <label
        htmlFor="wipe-cut"
        className="mt-4 flex items-center gap-3 font-mono text-[11px] text-mut"
      >
        <span>{t.label}</span>
        <input
          id="wipe-cut"
          type="range"
          min={0}
          max={100}
          step={1}
          value={cut}
          onChange={(e) => setCut(Number(e.target.value))}
          aria-label={`${t.ariaPre}${cut}${t.ariaPost}`}
          className="h-1 flex-1 accent-link"
        />
      </label>
    </InstrumentFigure>
  );
}
