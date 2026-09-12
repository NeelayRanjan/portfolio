"use client";

import { useEffect, useRef, useState } from "react";
import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { paintMaskCanvas, readToken, type MaskToken } from "@/components/figures/mask-paint";
import { copy } from "@/content/copy";
import data from "@/public/research/label_efficiency.json";
import ladderData from "@/public/research/ladder.json";

/**
 * Figure 2 — the label-efficiency ladder. Two halves, one control:
 *
 * 1. The Dice curve, computed from the paper's real per-image metrics
 *    (`scripts/prepare-research.mjs` aggregates
 *    `all_metrics_combined_long.csv` and asserts the headline number before
 *    writing `label_efficiency.json`).
 * 2. The mask strip: one real predicted mask per model at the slider's label
 *    budget, on the angiogram from Figure 1, with Dice computed by the same
 *    script from the exact PNG bytes each panel paints.
 *
 * A CLIENT component now (the slider), but both JSONs stay STATIC IMPORTS:
 * they are build-time data, bundled, never fetched, so there is no loading
 * state for either half.
 *
 * ⚠️ THE CURVE STILL ENDS AT 80 AND THAT IS THE POINT. The x domain runs to
 * the ladder's reach (320) so the cursor can travel the whole strip, but the
 * measured polylines stop where the CSV stops. The visible ending says "the
 * aggregate is measured to here" better than any caption can. Don't
 * extrapolate the lines to fill the axis.
 *
 * ⚠️ EVERY DICE ON SCREEN IS COMPUTED FROM THE PIXELS ON SCREEN. The panel
 * numbers come from `ladder.json` (per-image, per-mask, computed against the
 * benchmark ground truth), never from the CSV's seed means, which describe a
 * different export. They can and do land either side of the curve.
 *
 * Geometry is derived from the data, not hardcoded, so a re-export changes
 * the chart with no edit here:
 * - x domain spans every `labels` value in the curve AND every ladder budget.
 * - y domain pads slightly around the real min/max `diceMean`.
 * - y-axis ticks are drawn from the ACTUAL diceMean values in the file
 *   (spread across the sorted unique set), never round numbers a chart
 *   library would invent.
 * - End-of-line labels are placed at each model's last (80-label) point,
 *   then decluttered with a minimum vertical gap so the six baselines
 *   clustered between 0.83 and 0.92 Dice don't overlap into one smear. With
 *   the domain now reaching 320 they sit mid-chart, over empty plot, which
 *   reads as a legend at the exact x where the measurement runs out.
 */

type ModelRow = {
  fraction: number;
  labels: number;
  diceMean: number;
  diceStd: number;
  n: number;
};

const models = data.models as Record<string, ModelRow[]>;
const modelKeys = Object.keys(models);
const t = copy.research.figEfficiency;
const modelLabels: Record<string, string> = t.modelLabels;

/** Ladder tints. One token per model, and the panel is ALSO labeled in text
 *  plus an aria-label, so color is never the only carrier. */
const LADDER_TINTS: Record<string, MaskToken> = {
  x0diffusion: "--color-ok",
  vit_base_patch16: "--color-link",
  deeplabv3: "--color-warm",
};

const BUDGETS = ladderData.budgets;
const LADDER_MODELS = ladderData.models;
const diceAt = (modelKey: string, labels: number) =>
  LADDER_MODELS.find((m) => m.key === modelKey)?.series.find((s) => s.labels === labels)?.dice ??
  null;

const WIDTH = 680;
const HEIGHT = 340;
const MARGIN = { top: 16, right: 40, bottom: 40, left: 40 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const MIN_LABEL_GAP = 13;

const allRows = modelKeys.flatMap((key) => models[key]);
const curveX = Array.from(new Set(allRows.map((r) => r.labels))).sort((a, b) => a - b);
const measuredTo = curveX[curveX.length - 1];
const xValues = Array.from(new Set([...curveX, ...BUDGETS])).sort((a, b) => a - b);
const xDomain: [number, number] = [xValues[0], xValues[xValues.length - 1]];

const diceValues = allRows.map((r) => r.diceMean);
const yMin = Math.min(...diceValues);
const yMax = Math.max(...diceValues);
const yPad = (yMax - yMin) * 0.08 || 0.02;
const yDomain: [number, number] = [Math.max(0, yMin - yPad), Math.min(1, yMax + yPad)];

function xScale(labels: number): number {
  const [min, max] = xDomain;
  if (max === min) return MARGIN.left + PLOT_W / 2;
  return MARGIN.left + ((labels - min) / (max - min)) * PLOT_W;
}

function yScale(dice: number): number {
  const [min, max] = yDomain;
  if (max === min) return MARGIN.top + PLOT_H / 2;
  return MARGIN.top + (1 - (dice - min) / (max - min)) * PLOT_H;
}

// Real y-axis ticks: sample the sorted, de-duplicated diceMean values the
// data actually reaches rather than inventing round numbers.
const uniqueDice = Array.from(new Set(diceValues)).sort((a, b) => a - b);
const TICK_COUNT = Math.min(4, uniqueDice.length);
const yTicks = Array.from(
  new Set(
    Array.from({ length: TICK_COUNT }, (_, i) => {
      const idx =
        TICK_COUNT === 1
          ? 0
          : Math.round((i / (TICK_COUNT - 1)) * (uniqueDice.length - 1));
      return uniqueDice[idx];
    }),
  ),
).sort((a, b) => a - b);

const labelPlacements = modelKeys
  .map((key) => {
    const rows = models[key];
    const last = rows[rows.length - 1];
    return { key, x: xScale(last.labels) + 6, y: yScale(last.diceMean) };
  })
  .sort((a, b) => a.y - b.y);

for (let i = 1; i < labelPlacements.length; i++) {
  if (labelPlacements[i].y - labelPlacements[i - 1].y < MIN_LABEL_GAP) {
    labelPlacements[i].y = labelPlacements[i - 1].y + MIN_LABEL_GAP;
  }
}
const bottomEdge = MARGIN.top + PLOT_H;
const overflow = labelPlacements[labelPlacements.length - 1]?.y - bottomEdge;
if (overflow && overflow > 0) {
  for (const p of labelPlacements) p.y -= overflow;
}
const labelByKey = new Map(labelPlacements.map((p) => [p.key, p]));

/**
 * One model's panel: the angiogram, that model's mask painted over it, and the
 * Dice computed for those exact pixels.
 *
 * Painted canvases are cached per (model, budget) in a ref, so panning the
 * slider back is a `drawImage` rather than a decode. A budget whose mask has
 * not been painted yet shows the plain angiogram for the length of one decode
 * of a ~2 KB PNG, which is why there is no spinner here to design.
 */
function LadderPanel({
  modelKey,
  labels,
  dice,
  angiogramAlt,
}: {
  modelKey: string;
  labels: number;
  dice: number | null;
  angiogramAlt: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cache = useRef(new Map<number, HTMLCanvasElement>());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let live = true;

    const blit = (painted: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = painted.width;
      canvas.height = painted.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(painted, 0, 0);
    };

    const cached = cache.current.get(labels);
    if (cached) {
      blit(cached);
      return;
    }

    // Clear first: the previous budget's mask must not linger under the new
    // budget's number while this one decodes.
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    paintMaskCanvas(
      `/research/ladder/${modelKey}_${labels}.png`,
      readToken(LADDER_TINTS[modelKey] ?? "--color-ok"),
    )
      .then((painted) => {
        cache.current.set(labels, painted);
        if (live) blit(painted);
      })
      .catch(() => {
        /* The panel stays the plain angiogram: an absent mask shows nothing
           rather than something invented. */
      });

    return () => {
      live = false;
    };
  }, [modelKey, labels]);

  const name = modelLabels[modelKey] ?? modelKey;
  const shown = dice === null ? t.diceMissing : dice.toFixed(3);

  return (
    <div className="flex-1">
      <div className="relative aspect-square w-full overflow-hidden border border-rule bg-panel">
        <img
          src="/research/angiogram.webp"
          alt={angiogramAlt}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${t.maskAriaPre}${name}${t.maskAriaMid}${labels}${t.maskAriaPost}${shown}`}
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <div className="mt-2 font-mono text-[11px] leading-tight text-mut">
        <span className="text-ink">{name}</span>
        <br />
        {t.diceLabel} {shown}
      </div>
    </div>
  );
}

export function EfficiencyFigure() {
  const [budgetIdx, setBudgetIdx] = useState(0);
  const budget = BUDGETS[budgetIdx];

  return (
    <InstrumentFigure n="2" caption={t.caption} readout={`${t.readoutLabel} ${budget}`}>
      <div className="text-mut font-mono text-[10.5px]">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={t.caption}
        >
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

          {yTicks.map((v) => {
            const y = yScale(v);
            return (
              <g key={v}>
                <line
                  x1={MARGIN.left}
                  x2={MARGIN.left + PLOT_W}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                />
                <text x={MARGIN.left - 8} y={y + 3} textAnchor="end" fill="currentColor">
                  {v.toFixed(2)}
                </text>
              </g>
            );
          })}

          {xValues.map((v) => (
            <text
              key={v}
              x={xScale(v)}
              y={bottomEdge + 16}
              textAnchor="middle"
              fill="currentColor"
            >
              {v}
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

          {/* The slider's budget, marked across the full domain. This is the
              one thing tying the two halves together: it is the same x the
              panels below are showing. */}
          <line
            x1={xScale(budget)}
            x2={xScale(budget)}
            y1={MARGIN.top}
            y2={bottomEdge}
            stroke="var(--color-warm)"
            strokeOpacity={0.75}
            strokeDasharray="3 3"
          />

          {modelKeys
            .filter((key) => key !== "x0diffusion")
            .map((key) => (
              <polyline
                key={key}
                points={models[key].map((r) => `${xScale(r.labels)},${yScale(r.diceMean)}`).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
              />
            ))}

          {models.x0diffusion && (
            <polyline
              points={models.x0diffusion
                .map((r) => `${xScale(r.labels)},${yScale(r.diceMean)}`)
                .join(" ")}
              fill="none"
              stroke="var(--color-red-ink)"
              strokeWidth={2}
            />
          )}

          {/* Says out loud what the lines ending mid-axis already shows. */}
          <text
            x={xScale(measuredTo)}
            y={MARGIN.top + 8}
            textAnchor="start"
            fill="currentColor"
            fillOpacity={0.75}
          >
            {t.measuredToPre}
            {measuredTo}
            {t.measuredToPost}
          </text>

          {modelKeys.map((key) => {
            const placement = labelByKey.get(key);
            if (!placement) return null;
            const isHeadline = key === "x0diffusion";
            return (
              <text
                key={key}
                x={placement.x}
                y={placement.y + 3}
                fill={isHeadline ? "var(--color-red-ink)" : "currentColor"}
              >
                {modelLabels[key] ?? key}
              </text>
            );
          })}
        </svg>
      </div>

      {/* The ladder strip. Three real masks for one real image, side by side,
          so the crossover is one glance rather than a vertical scan. */}
      <div id="fig-ladder" className="mt-6 flex flex-col gap-4 sm:flex-row">
        {LADDER_MODELS.map((m) => (
          <LadderPanel
            key={m.key}
            modelKey={m.key}
            labels={budget}
            dice={diceAt(m.key, budget)}
            angiogramAlt={copy.research.figWipe.angiogramAlt}
          />
        ))}
      </div>

      <label
        htmlFor="ladder-budget"
        className="mt-4 flex items-center gap-3 font-mono text-[11px] text-mut"
      >
        <span>{t.ladderLabel}</span>
        <input
          id="ladder-budget"
          type="range"
          min={0}
          max={BUDGETS.length - 1}
          step={1}
          value={budgetIdx}
          onChange={(e) => setBudgetIdx(Number(e.target.value))}
          aria-label={`${t.ladderAriaPre}${budget}${t.ladderAriaMid}${BUDGETS[0]} to ${
            BUDGETS[BUDGETS.length - 1]
          }`}
          className="h-1 flex-1 accent-link"
        />
      </label>
    </InstrumentFigure>
  );
}
