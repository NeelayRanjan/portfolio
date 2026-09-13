"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { paintMaskCanvas, readToken, type MaskToken } from "@/components/figures/mask-paint";
import { copy } from "@/content/copy";
import cdfData from "@/public/research/cdf.json";

/**
 * Figure 2 — the paper's Dice CDF (external_materials/paper1/img/fig_dice_cdf),
 * made pannable. Two halves, one control:
 *
 * 1. THE CURVE. The empirical CDF of every per-image test Dice at the 16-label
 *    budget, one line per model, computed by `scripts/prepare-research.mjs`
 *    from `all_metrics_combined_long.csv` (2500 rows per model: all seeds, all
 *    folds, all 100 test images). The script asserts the share below 0.5 Dice
 *    against bands read off the paper's own figure and writes nothing if the
 *    shape has changed.
 * 2. THE STRIP. One real test image per slider stop, with all three models'
 *    masks over it and the Dice the script computed from the exact PNG bytes
 *    each panel paints.
 *
 * ⚠️ THE Y AXIS IS CLIPPED AT 30%, as in the paper. The whole finding is in the
 * failure tail, and an axis running to 100% squashes it into the bottom eighth.
 * The curves are truncated where they leave the plot (with an interpolated
 * point exactly on the ceiling), never drawn past it, and a mono note says the
 * axis is clipped. The share readouts are NOT clipped: they are the real
 * number at the cursor, which at 0.9 Dice is most of the distribution.
 *
 * ⚠️ THREE CARRIERS PER SERIES, and that is the paper's own encoding married to
 * this site's hues: line style (solid / dashed / dotted, the paper's), color
 * (green x0-diffusion, red SAM, amber ResNet-UNet) and a named legend entry.
 * Red is SAM here because red is SAM in Figure 1; nothing on this page reads
 * red as "bad".
 *
 * ⚠️ THE CURSOR IS STILL A THRESHOLD, NOT THE SHOWN IMAGE'S SCORE, though
 * since the 2026-09-13 re-source it is a close one: the strip draws on the
 * test_predictions re-export (all 100 test images, seed-1/fold-1), and the
 * script picks per stop by nearest-with-dedupe on SAM's computed Dice, so a
 * 0.3 stop shows an image scoring near 0.3, genuine failures included. Every
 * panel prints its own computed number. Don't retitle the strip as "images
 * AT this Dice" — nearest is nearest. And note SAM's caveat: its inference is
 * stochastic, so the re-exported masks are a fresh draw that can score off
 * the CSV's recorded row (root-caused in scripts/prepare-research.mjs; the
 * trained models reproduce their rows, ResNet-UNet to the fourth decimal).
 *
 * ⚠️ THE ANGIOGRAM IS SHIPPED SQUASHED TO THE MASK'S SQUARE, so the panels use
 * a plain stretched <img> and NOT `object-cover`. The prediction pipeline
 * squashed its input, so the squashed frame is the one the masks are registered
 * to; cropping to square instead slides the overlay ~8% off the vessels.
 *
 * ⚠️ POLARITY COMES FROM THE FILE, not from a client-side detector. These masks
 * carry no shared convention (SAM alone writes black-vessel-on-white for 5 of
 * its 10), so `cdf.json` records the polarity the script SCORED each mask under
 * and `paintMaskCanvas` is handed it. The number beside a panel and the pixels
 * inside it therefore cannot disagree.
 */

type Stop = (typeof cdfData.stops)[number];
type ModelKey = keyof Stop["masks"];

const t = copy.research.figCdf;
const MODELS = cdfData.models as ModelKey[];
const STOPS = cdfData.stops as Stop[];
const curves = cdfData.curves as Record<ModelKey, number[][]>;

/** Line style + color + tint per model. The legend names them in words too. */
const SERIES: Record<ModelKey, { color: string; dash?: string; width: number; tint: MaskToken }> = {
  x0diffusion: { color: "var(--color-ok)", width: 2, tint: "--color-ok" },
  sam: { color: "var(--color-red-ink)", dash: "7 4", width: 1.6, tint: "--color-red-ink" },
  resnet: { color: "var(--color-warm)", dash: "1.6 3.2", width: 1.6, tint: "--color-warm" },
};

const WIDTH = 680;
const HEIGHT = 300;
const MARGIN = { top: 12, right: 18, bottom: 40, left: 48 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
/** The paper's ceiling. Read from nothing: it IS the editorial decision. */
const Y_MAX = 0.3;
const REF_DICE = 0.5;

const xScale = (dice: number) => MARGIN.left + dice * PLOT_W;
const yScale = (share: number) => MARGIN.top + (1 - Math.min(share, Y_MAX) / Y_MAX) * PLOT_H;
const bottomEdge = MARGIN.top + PLOT_H;

const Y_TICKS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
const X_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];

/**
 * The visible part of one curve: every point up to the 30% ceiling, plus one
 * interpolated point exactly ON the ceiling where it crosses. Linear
 * interpolation between two adjacent real points is the honest way to end a
 * line at a clipped axis, and the alternative (an SVG clip-path) hides the fact
 * that the line kept going.
 */
function clippedPoints(pts: number[][]): string {
  const out: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [dice, share] = pts[i];
    if (share <= Y_MAX) {
      out.push(`${xScale(dice)},${yScale(share)}`);
      continue;
    }
    const prev = pts[i - 1];
    if (prev) {
      const span = share - prev[1];
      const f = span === 0 ? 0 : (Y_MAX - prev[1]) / span;
      out.push(`${xScale(prev[0] + f * (dice - prev[0]))},${yScale(Y_MAX)}`);
    }
    break;
  }
  return out.join(" ");
}

const pct = (share: number) => `${(share * 100).toFixed(share >= 0.1 ? 1 : 2)}%`;

/**
 * One column of the strip: the angiogram, optionally one model's mask over it,
 * and the Dice computed for those exact pixels.
 *
 * Painted canvases are cached per stop in a ref, so panning back is a
 * `drawImage` rather than a decode of a fresh PNG.
 */
function MaskPanel({
  stop,
  model,
}: {
  stop: Stop;
  model: ModelKey | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cache = useRef(new Map<string, HTMLCanvasElement>());
  const mask = model ? stop.masks[model] : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mask || !model) return;
    let live = true;

    const blit = (painted: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = painted.width;
      canvas.height = painted.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(painted, 0, 0);
    };

    const cached = cache.current.get(mask.file);
    if (cached) {
      blit(cached);
      return;
    }

    // Clear first: the previous stop's mask must not linger under this stop's
    // number while the new PNG decodes.
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    paintMaskCanvas(`/research/${mask.file}`, readToken(SERIES[model].tint), mask.vesselIsWhite)
      .then((painted) => {
        cache.current.set(mask.file, painted);
        if (live) blit(painted);
      })
      .catch(() => {
        /* The panel stays the plain angiogram: an absent mask shows nothing
           rather than something invented. */
      });

    return () => {
      live = false;
    };
  }, [mask, model]);

  const name = model ? t.modelLabels[model] : t.angioLabel;
  const alt = `${t.angioAltPre}${stop.image}`;

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden border border-rule bg-panel">
        {/* Stretched, not cropped: see the squash note at the top of the file. */}
        <img
          src={`/research/${stop.angio}`}
          alt={model ? "" : alt}
          aria-hidden={model ? true : undefined}
          className="absolute inset-0 h-full w-full"
        />
        {mask && model ? (
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`${t.maskAriaPre}${t.modelLabels[model]}${t.maskAriaMid}${stop.image}${t.maskAriaPost}${mask.dice.toFixed(3)}`}
            className="absolute inset-0 h-full w-full"
          />
        ) : null}
      </div>
      <div className="mt-2 font-mono text-[11px] leading-tight text-mut">
        <span style={model ? { color: SERIES[model].color } : undefined}>{name}</span>
        <br />
        {mask ? `${t.diceLabel} ${mask.dice.toFixed(3)}` : `${t.imagePre}${stop.image}`}
      </div>
    </div>
  );
}

export function DiceCdfFigure() {
  const defaultIdx = Math.max(
    0,
    STOPS.findIndex((s) => s.t === 0.3),
  );
  const [idx, setIdx] = useState(defaultIdx);
  const stop = STOPS[idx];

  const paths = useMemo(
    () => MODELS.map((m) => ({ model: m, points: clippedPoints(curves[m]) })),
    [],
  );

  return (
    <InstrumentFigure
      n="2"
      caption={t.caption}
      readout={`${t.readoutLabel} ${stop.t.toFixed(2)}`}
    >
      <div className="text-mut font-mono text-[10.5px]">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={t.chartAria}>
          {/* axes */}
          <line
            x1={MARGIN.left}
            y1={MARGIN.top}
            x2={MARGIN.left}
            y2={bottomEdge}
            stroke="currentColor"
            strokeOpacity={0.4}
          />
          <line
            x1={MARGIN.left}
            y1={bottomEdge}
            x2={MARGIN.left + PLOT_W}
            y2={bottomEdge}
            stroke="currentColor"
            strokeOpacity={0.4}
          />

          {Y_TICKS.map((v) => (
            <g key={v}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + PLOT_W}
                y1={yScale(v)}
                y2={yScale(v)}
                stroke="currentColor"
                strokeOpacity={0.1}
              />
              <text
                x={MARGIN.left - 8}
                y={yScale(v) + 3}
                textAnchor="end"
                fill="currentColor"
              >
                {`${Math.round(v * 100)}%`}
              </text>
            </g>
          ))}

          {X_TICKS.map((v) => (
            <text
              key={v}
              x={xScale(v)}
              y={bottomEdge + 15}
              textAnchor="middle"
              fill="currentColor"
            >
              {v.toFixed(1)}
            </text>
          ))}
          <text
            x={MARGIN.left + PLOT_W / 2}
            y={HEIGHT - 6}
            textAnchor="middle"
            fill="currentColor"
          >
            {t.xAxisLabel}
          </text>
          <text
            x={12}
            y={MARGIN.top + PLOT_H / 2}
            textAnchor="middle"
            fill="currentColor"
            transform={`rotate(-90 12 ${MARGIN.top + PLOT_H / 2})`}
          >
            {t.yAxisLabel}
          </text>

          {/* The paper's reference line. */}
          <line
            x1={xScale(REF_DICE)}
            x2={xScale(REF_DICE)}
            y1={MARGIN.top}
            y2={bottomEdge}
            stroke="currentColor"
            strokeOpacity={0.45}
          />
          <text
            x={xScale(REF_DICE) + 4}
            y={MARGIN.top + 9}
            fill="currentColor"
            fillOpacity={0.6}
          >
            {REF_DICE}
          </text>

          {/* The slider's threshold, marked across the plot. Blue: the three
              series already own green, red and amber. */}
          <line
            x1={xScale(stop.t)}
            x2={xScale(stop.t)}
            y1={MARGIN.top}
            y2={bottomEdge}
            stroke="var(--color-link)"
            strokeWidth={1.4}
            strokeDasharray="3 3"
          />

          {paths.map(({ model, points }) => (
            <polyline
              key={model}
              points={points}
              fill="none"
              stroke={SERIES[model].color}
              strokeWidth={SERIES[model].width}
              strokeDasharray={SERIES[model].dash}
              strokeLinecap="butt"
            />
          ))}

          {/* Legend: line sample + name, in the paper's position. */}
          {MODELS.map((model, i) => {
            const y = MARGIN.top + 12 + i * 14;
            return (
              <g key={model}>
                <line
                  x1={MARGIN.left + 10}
                  x2={MARGIN.left + 40}
                  y1={y}
                  y2={y}
                  stroke={SERIES[model].color}
                  strokeWidth={SERIES[model].width}
                  strokeDasharray={SERIES[model].dash}
                />
                <text x={MARGIN.left + 46} y={y + 3.5} fill={SERIES[model].color}>
                  {t.modelLabels[model]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="mt-1 font-mono text-[10.5px] text-mut">{t.clipNote}</p>

      {/* The exact shares at the cursor. Computed row counts, not read off the
          curve's downsampled points. */}
      <div
        id="fig-cdf-readouts"
        role="status"
        className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[11px] text-mut tabular-nums"
      >
        <span>
          {t.sharePre}
          {stop.t.toFixed(2)}
          {t.sharePost}
        </span>
        {MODELS.map((m) => (
          <span key={m} data-model={m}>
            <span style={{ color: SERIES[m].color }}>{t.modelLabels[m]}</span>{" "}
            <span className="text-ink">{pct(stop.shares[m])}</span>
          </span>
        ))}
      </div>

      <label
        htmlFor="cdf-dice"
        className="mt-4 flex items-center gap-3 font-mono text-[11px] text-mut"
      >
        <span>{t.sliderLabel}</span>
        <input
          id="cdf-dice"
          type="range"
          min={0}
          max={STOPS.length - 1}
          step={1}
          value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
          aria-label={`${t.sliderAriaPre}${stop.t.toFixed(2)}${t.sliderAriaPost}`}
          className="h-1 flex-1 accent-link"
        />
      </label>

      {/* The strip: the angiogram, then the three masks, so the comparison is
          one glance rather than a vertical scan. */}
      <div id="fig-cdf-strip" className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MaskPanel stop={stop} model={null} />
        {MODELS.map((m) => (
          <MaskPanel key={m} stop={stop} model={m} />
        ))}
      </div>

      <p className="mt-3 font-mono text-[10.5px] leading-relaxed text-mut">
        {t.scopeNotePre}
        {cdfData.labels}
        {t.scopeNoteMid}
        {cdfData.rowsPerModel}
        {t.scopeNotePost}
      </p>
    </InstrumentFigure>
  );
}
