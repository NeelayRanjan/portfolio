"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { copy } from "@/content/copy";

const FALLBACK_RED = { r: 0xe5, g: 0x35, b: 0x2b }; // --color-red-ink, in case the token can't be read live

function readRedInk(): { r: number; g: number; b: number } {
  if (typeof document === "undefined") return FALLBACK_RED;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-red-ink")
    .trim();
  const match = /^#([0-9a-f]{6})$/i.exec(raw);
  if (!match) return FALLBACK_RED;
  const hex = match[1];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/**
 * Figure 1 — the wipe: a real angiogram (image 189 from the pelvic-iliac
 * benchmark) with two real segmentation masks laid over it, dragged into
 * comparison.
 *
 * Layer order, bottom to top, all filling the same box:
 * 1. `angiogram.webp` — the base image.
 * 2. `mask_sam.png` — SAM's mask, ALWAYS fully visible, composited with
 *    `mix-blend-mode: multiply`. The PNG is genuinely black-vessel-on-white
 *    (verified: ~24.5% black pixels), so multiply darkens exactly the
 *    pixels SAM calls vessel and leaves the white background a no-op —
 *    neutral, no hue added, which is the "untinted" requirement.
 * 3. The x0-diffusion mask, red-tinted and clipped.
 *
 * ⚠️ `mask_x0.png` is the OPPOSITE polarity (white vessel on black, ~80%
 * black background; verified), so it can't take SAM's multiply trick — and
 * CSS `mask-image` (the obvious fix, since `mask-mode` should fall back to
 * luminance for a source with no alpha channel) was tried first and is NOT
 * reliable here: verified in a real headless-Firefox screenshot that the
 * masked layer painted as 100% opaque red across the WHOLE box, mask
 * entirely ignored, even though every computed style (`mask-image`,
 * `mask-mode: match-source`, `mask-type: luminance`) reported correctly
 * applied. Same family of trap as this repo's documented Firefox
 * `screenshot({omitBackground})` gap: the property parses and computes but
 * doesn't paint. So this recolors the mask on a `<canvas>` instead — read
 * the PNG's pixels directly, and for each one either write the live
 * `--color-red-ink` value at full alpha (the vessel) or zero alpha (the
 * background). That's pixel-level, has no dependency on mask/blend support,
 * and is verified to render correctly in the same environment.
 *
 * `clip-path: inset(0 0 0 var(--cut))` — the literal form named in the
 * brief, via a CSS custom property rather than a recomputed inline string —
 * is what wipes that canvas. At `--cut: 0%` the inset is zero on every
 * side, so the whole canvas shows; at `--cut: 100%` the inset rectangle has
 * zero width and the canvas disappears entirely, leaving just the
 * angiogram + SAM underneath. Dragging the slider wipes the red
 * x0-diffusion mask away from the left — "cut" is how much of the overlay
 * has been cut away.
 */
export function WipeFigure() {
  const [cut, setCut] = useState(50);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t = copy.research.figWipe;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { r, g, b } = readRedInk();
      const px = frame.data;
      for (let i = 0; i < px.length; i += 4) {
        // Grayscale, no alpha channel: r === g === b. White (vessel, ~255)
        // becomes opaque red-ink; black (background, ~0) becomes fully
        // transparent so the layers underneath show through.
        const on = px[i] > 127;
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
        px[i + 3] = on ? 255 : 0;
      }
      ctx.putImageData(frame, 0, 0);
    };
    img.src = "/research/mask_x0.png";
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
        <img
          src="/research/mask_sam.png"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover mix-blend-multiply"
        />
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 h-full w-full"
          style={clipStyle}
        />
        <div
          aria-hidden
          className="absolute top-0 bottom-0 w-px bg-ink/70"
          style={{ left: `${cut}%` }}
        />
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
