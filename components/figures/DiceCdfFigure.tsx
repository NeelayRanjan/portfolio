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

/** Chart geometry, in viewBox units. Two layouts of the same chart, chosen
 *  by CSS at 880px (round 2, 2026-10-27, Figure 1's pattern): the SVG
 *  scales to its box, so one 680-unit viewBox drew its 10.5-unit type at
 *  ~4px on a phone and ~8px in the desktop's ~518px column. Wide is 520
 *  units with 12-unit type (11-12px rendered); narrow is 360 units with
 *  15-unit type, capped at 400px wide. Wide comes first in the DOM: it is
 *  the layout the suite's cdf check reads. */
type Geo = {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  font: number;
  tickGap: number;
  yTickDy: number;
  xTickDy: number;
  yTitleX: number;
  legendRow: number;
  legendLine: number;
};
const WIDE: Geo = {
  width: 520,
  height: 260,
  margin: { top: 12, right: 14, bottom: 44, left: 52 },
  font: 12,
  tickGap: 8,
  yTickDy: 4,
  xTickDy: 17,
  yTitleX: 13,
  legendRow: 17,
  legendLine: 30,
};
const NARROW: Geo = {
  width: 360,
  height: 270,
  margin: { top: 14, right: 12, bottom: 50, left: 56 },
  font: 15,
  tickGap: 7,
  yTickDy: 5,
  xTickDy: 20,
  yTitleX: 15,
  legendRow: 20,
  legendLine: 26,
};
/** The paper's ceiling. Read from nothing: it IS the editorial decision. */
const Y_MAX = 0.3;
const REF_DICE = 0.5;

function scales(g: Geo) {
  const plotW = g.width - g.margin.left - g.margin.right;
  const plotH = g.height - g.margin.top - g.margin.bottom;
  return {
    plotW,
    plotH,
    x: (dice: number) => g.margin.left + dice * plotW,
    y: (share: number) => g.margin.top + (1 - Math.min(share, Y_MAX) / Y_MAX) * plotH,
    bottomEdge: g.margin.top + plotH,
  };
}

const Y_TICKS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
const X_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];

/**
 * The visible part of one curve: every point up to the 30% ceiling, plus one
 * interpolated point exactly ON the ceiling where it crosses. Linear
 * interpolation between two adjacent real points is the honest way to end a
 * line at a clipped axis, and the alternative (an SVG clip-path) hides the fact
 * that the line kept going.
 */
function clippedPoints(pts: number[][], xScale: (d: number) => number, yScale: (s: number) => number): string {
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

/** One layout of the chart (see Geo). `paths` are recomputed per layout,
 *  since the clipped polylines are in each layout's own units. */
function CdfChart({ g, stop }: { g: Geo; stop: Stop }) {
  const sc = scales(g);
  const paths = useMemo(
    () => MODELS.map((m) => ({ model: m, points: clippedPoints(curves[m], sc.x, sc.y) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g],
  );
  return (
    <svg viewBox={`0 0 ${g.width} ${g.height}`} className="w-full" role="img" aria-label={t.chartAria} fontSize={g.font}>
      {/* axes */}
      <line
        x1={g.margin.left}
        y1={g.margin.top}
        x2={g.margin.left}
        y2={sc.bottomEdge}
        stroke="currentColor"
        strokeOpacity={0.4}
      />
      <line
        x1={g.margin.left}
        y1={sc.bottomEdge}
        x2={g.margin.left + sc.plotW}
        y2={sc.bottomEdge}
        stroke="currentColor"
        strokeOpacity={0.4}
      />

      {Y_TICKS.map((v) => (
        <g key={v}>
          <line
            x1={g.margin.left}
            x2={g.margin.left + sc.plotW}
            y1={sc.y(v)}
            y2={sc.y(v)}
            stroke="currentColor"
            strokeOpacity={0.1}
          />
          <text
            x={g.margin.left - g.tickGap}
            y={sc.y(v) + g.yTickDy}
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
          x={sc.x(v)}
          y={sc.bottomEdge + g.xTickDy}
          textAnchor="middle"
          fill="currentColor"
        >
          {v.toFixed(1)}
        </text>
      ))}
      <text
        x={g.margin.left + sc.plotW / 2}
        y={g.height - 6}
        textAnchor="middle"
        fill="currentColor"
      >
        {t.xAxisLabel}
      </text>
      <text
        x={g.yTitleX}
        y={g.margin.top + sc.plotH / 2}
        textAnchor="middle"
        fill="currentColor"
        transform={`rotate(-90 ${g.yTitleX} ${g.margin.top + sc.plotH / 2})`}
      >
        {t.yAxisLabel}
      </text>

      {/* The paper's reference line. */}
      <line
        x1={sc.x(REF_DICE)}
        x2={sc.x(REF_DICE)}
        y1={g.margin.top}
        y2={sc.bottomEdge}
        stroke="currentColor"
        strokeOpacity={0.45}
      />
      <text
        x={sc.x(REF_DICE) + 4}
        y={g.margin.top + g.font * 0.85}
        fill="currentColor"
        fillOpacity={0.6}
      >
        {REF_DICE}
      </text>

      {/* The slider's threshold, marked across the plot. Blue: the three
          series already own green, red and amber. */}
      <line
        x1={sc.x(stop.t)}
        x2={sc.x(stop.t)}
        y1={g.margin.top}
        y2={sc.bottomEdge}
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
        const y = g.margin.top + g.legendRow * 0.7 + i * g.legendRow;
        return (
          <g key={model}>
            <line
              x1={g.margin.left + 10}
              x2={g.margin.left + 10 + g.legendLine}
              y1={y}
              y2={y}
              stroke={SERIES[model].color}
              strokeWidth={SERIES[model].width}
              strokeDasharray={SERIES[model].dash}
            />
            <text x={g.margin.left + 16 + g.legendLine} y={y + g.yTickDy} fill={SERIES[model].color}>
              {t.modelLabels[model]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function DiceCdfFigure() {
  const defaultIdx = Math.max(
    0,
    STOPS.findIndex((s) => s.t === 0.3),
  );
  const [idx, setIdx] = useState(defaultIdx);
  const stop = STOPS[idx];

  return (
    <InstrumentFigure
      n="2"
      id="fig-cdf"
      caption={t.caption}
      readout={`${t.readoutLabel} ${stop.t.toFixed(2)}`}
    >
      <div className="text-mut font-mono">
        <div className="hidden min-[880px]:block">
          <CdfChart g={WIDE} stop={stop} />
        </div>
        {/* pt-5: the figure's amber readout sits in the top-right corner,
            over the narrow chart's plot otherwise. */}
        <div className="mx-auto max-w-[400px] pt-5 min-[880px]:hidden">
          <CdfChart g={NARROW} stop={stop} />
        </div>
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
          className="h-6 flex-1"
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
        {cdfData.rowsPerModel.toLocaleString("en-US")}
        {t.scopeNotePost}
      </p>
    </InstrumentFigure>
  );
}
