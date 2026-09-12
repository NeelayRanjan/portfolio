"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { paintMask, readToken } from "@/components/figures/mask-paint";
import { copy } from "@/content/copy";

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
