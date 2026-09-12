/**
 * Shared mask painting for the research figures (Figure 1's wipe and Figure
 * 2's label-efficiency ladder). Hoisted out of `WipeFigure.tsx` when the
 * ladder needed the same two things: read a theme token as RGB, and recolor a
 * binary mask PNG onto a canvas.
 *
 * Canvas pixel-recoloring, NOT CSS mask-image: mask-image computes correctly
 * but silently fails to paint in this repo's headless Firefox (verified in
 * Task 6 — same family as the documented `omitBackground` gap), so every mask
 * layer on the page goes through this one code path.
 */

/** Fallbacks in case the tokens can't be read live (SSR, or a stripped style). */
const FALLBACK = {
  "--color-ok": { r: 0x63, g: 0xc6, b: 0x8c },
  "--color-red-ink": { r: 0xe5, g: 0x35, b: 0x2b },
  "--color-link": { r: 0x7b, g: 0xa7, b: 0xdc },
  "--color-warm": { r: 0xd9, g: 0xa4, b: 0x5b },
} as const;

export type MaskToken = keyof typeof FALLBACK;
export type Rgb = { r: number; g: number; b: number };

export function readToken(name: MaskToken): Rgb {
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
 * ⚠️ Polarity is DETECTED, not assumed, and the detector is the IMAGE BORDER.
 *
 * The exported masks do not share a convention. Image 189's SAM mask is
 * black-vessel-on-white while image 330's is white-vessel-on-black, and in the
 * ladder's prediction cache the polarity flips again with the label budget
 * (every mask at 320 labels is black-vessel-on-white, every mask below it is
 * white-vessel-on-black). Hardcoding the polarity painted the entire
 * background red on the first swap.
 *
 * The border is what tells the two sides apart: background always runs out to
 * the edge of the frame, vessels essentially never do. Measured across the 15
 * ladder masks plus both wipe masks and the ground truth, the border side is
 * the background in all 18.
 *
 * The rule this replaced was "the vessel is the minority class", which is true
 * of a good prediction and false of a broken one: ViT-DPT at 16 labels calls
 * 67.7% of image 330 vessel, so the minority rule painted its complement, on
 * exactly the panel whose job is showing the failure. The two rules agree on
 * all 17 masks where the minority rule is defensible (both wipe masks
 * included, so Figure 1 renders identically), and disagree only where it is
 * wrong.
 */
function detectVesselIsWhite(px: Uint8ClampedArray, width: number, height: number): boolean {
  let borderWhite = 0;
  let borderTotal = 0;
  const at = (x: number, y: number) => px[(y * width + x) * 4];
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      borderTotal++;
      if (at(x, y) > 127) borderWhite++;
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (const x of [0, width - 1]) {
      borderTotal++;
      if (at(x, y) > 127) borderWhite++;
    }
  }
  // The border is background, so the vessel is whichever side the border isn't.
  return borderTotal > 0 && borderWhite / borderTotal < 0.5;
}

/** Size `canvas` to `img` and recolor: vessel pixels become `tint` at full
 *  alpha, background pixels become fully transparent. */
function renderMask(canvas: HTMLCanvasElement, img: HTMLImageElement, tint: Rgb) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = frame.data;
  const vesselIsWhite = detectVesselIsWhite(px, canvas.width, canvas.height);
  for (let i = 0; i < px.length; i += 4) {
    const on = vesselIsWhite ? px[i] > 127 : px[i] < 127;
    px[i] = tint.r;
    px[i + 1] = tint.g;
    px[i + 2] = tint.b;
    px[i + 3] = on ? 255 : 0;
  }
  ctx.putImageData(frame, 0, 0);
}

/**
 * Recolor a binary mask PNG onto an existing canvas. Fire-and-forget: the
 * paint lands whenever the image decodes.
 */
export function paintMask(canvas: HTMLCanvasElement, src: string, tint: Rgb) {
  const img = new Image();
  img.onload = () => renderMask(canvas, img, tint);
  img.src = src;
}

/**
 * Same recolor, onto a DETACHED canvas that the caller can keep. The ladder
 * caches one of these per (model, budget) so panning the slider back is a
 * `drawImage`, not a decode.
 */
export function paintMaskCanvas(src: string, tint: Rgb): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      renderMask(canvas, img, tint);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error(`mask failed to load: ${src}`));
    img.src = src;
  });
}
