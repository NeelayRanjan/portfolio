"use client";

import { useEffect, useRef, useState } from "react";
import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { paintMaskCanvas, readToken, type MaskToken } from "@/components/figures/mask-paint";
import { copy } from "@/content/copy";
import effData from "@/public/research/label_efficiency.json";

/**
 * Figure 1 — the label-efficiency sweep (2026-09-12, replacing the wipe):
 * mean test Dice vs label budget for all seven models in
 * `public/research/label_efficiency.json`, which `scripts/prepare-research.mjs`
 * pools from the paper's own metrics CSV (2,500 per-image predictions per
 * point: all seeds, all folds, all 100 test images). This is the graph the
 * site's headline number lives in: 0.882 is the x0-diffusion point at 16
 * labels.
 *
 * One control, the same pattern as Figure 2: a slider that snaps between the
 * three budgets the paper ran (16 / 32 / 80 labels). The cursor line, the
 * one-standard-deviation whiskers, the per-model readouts and the lead/trail
 * sentence all follow it. The curves themselves never change — they are the
 * data, all of it, at every stop.
 *
 * ⚠️ EVERYTHING IS READ FROM THE FILE. Budgets, fractions, train size, means,
 * stds: a regenerated export changes the figure with no code edit, and the
 * lead/trail sentence is computed per stop (x0 leads at 16, TRAILS DeepLabV3
 * at 32 and ResNet-UNet at 80 — that flip is the claim, so don't "fix" it).
 *
 * ⚠️ SAM'S LINE IS FLAT BECAUSE THE DATA IS. SAM is zero-shot and never
 * trains on the labels; the CSV replicates its 2,500 per-image scores at
 * every fraction (verified: identical mean/std at 0.05/0.1/0.25). Don't
 * de-duplicate it out of the chart — the flat line IS its story.
 *
 * ⚠️ THE X AXIS IS LOG-SPACED (a mono note under the chart says so). Budgets
 * 16→32→80 are multiplicative steps; linear spacing shoves 16 and 32
 * together and makes the crossover look later than it is.
 *
 * ⚠️ COLOR IS NEVER THE ONLY CARRIER (house rule): every series has its own
 * dash pattern and a named legend entry, and the three hues Figure 2 already
 * assigned (green x0, dashed red SAM, dotted amber ResNet-UNet) are kept
 * identical here so the two figures read as one system.
 *
 * THE STRIP (added 2026-09-13, from the test_predictions re-export): one real
 * test angiogram with x0-diffusion's and ResNet-UNet's masks at the SELECTED
 * budget, so the crossover is visible in pixels while the slider moves. Data
 * and rules come from `strip` in the json (image pick rule and per-panel
 * audit in provenance.json): polarity is the RECORDED `vesselIsWhite`, the
 * Dice is computed from the exact shipped bytes, tints are each model's
 * series hue, and the whole strip is gated on the block's presence, so an
 * older json without it renders the chart alone. Painted canvases are cached
 * per file, same as Figure 2's panels.
 */

type Point = { fraction: number; labels: number; diceMean: number; diceStd: number; n: number };
type ModelKey = keyof typeof effData.models;

const t = copy.research.figLabelEff;

/** Display order: descending mean at the smallest budget, so the legend reads
 *  top-to-bottom the way the left edge of the chart does. */
const MODELS: ModelKey[] = [
  "x0diffusion",
  "sam",
  "vit_base_patch16",
  "hybridresnetvit",
  "resnet",
  "deeplabv3",
  "ediffusion",
];

/** The budgets, off the file. Every model must carry the same ones — a
 *  malformed export throws (an export bug that swallowing would hide). */
const BUDGETS = (effData.models.x0diffusion as Point[]).map((p) => p.labels);
const SERIES_POINTS: Record<ModelKey, Point[]> = Object.fromEntries(
  MODELS.map((m) => {
    const pts = effData.models[m] as Point[];
    if (pts.length !== BUDGETS.length || pts.some((p, i) => p.labels !== BUDGETS[i])) {
      throw new Error(`label_efficiency.json: ${m} does not carry budgets ${BUDGETS.join("/")}`);
    }
    return [m, pts];
  }),
) as Record<ModelKey, Point[]>;

/** Line style per model. Figure 2's three series keep exactly its styles. */
const SERIES: Record<ModelKey, { color: string; dash?: string; width: number }> = {
  x0diffusion: { color: "var(--color-ok)", width: 2 },
  sam: { color: "var(--color-red-ink)", dash: "7 4", width: 1.6 },
  resnet: { color: "var(--color-warm)", dash: "1.6 3.2", width: 1.6 },
  vit_base_patch16: { color: "var(--color-link)", dash: "10 3", width: 1.4 },
  hybridresnetvit: { color: "var(--color-mut)", dash: "5 3", width: 1.2 },
  deeplabv3: { color: "var(--color-mut)", width: 1.2 },
  ediffusion: { color: "var(--color-mut)", dash: "1.6 3.2", width: 1.2 },
};

/** The strip block, gated on presence and shape (an older json has none). */
type StripMask = { file: string; dice: number; vesselIsWhite: boolean; width: number; height: number };
type Strip = {
  image: number;
  angio: string;
  models: string[];
  budgets: { fraction: number; labels: number; masks: Record<string, StripMask> }[];
};
const STRIP: Strip | null = (() => {
  const s = (effData as { strip?: Strip }).strip;
  if (!s || !Array.isArray(s.budgets)) return null;
  if (s.budgets.length !== BUDGETS.length || s.budgets.some((b, i) => b.labels !== BUDGETS[i])) {
    throw new Error("label_efficiency.json: strip budgets disagree with the chart's budgets");
  }
  return s;
})();
/** Mask tint per strip model: the model's own series hue. */
const STRIP_TINTS: Record<string, MaskToken> = {
  x0diffusion: "--color-ok",
  resnet: "--color-warm",
};

const WIDTH = 680;
const HEIGHT = 320;
const MARGIN = { top: 12, right: 18, bottom: 44, left: 48 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

/** Inner padding on the x range: the end budgets otherwise land exactly on
 *  the y axis and the right edge, which hides the cursor at the default stop
 *  and clips the whiskers (seen in the first screenshot pass). Sized for the
 *  whisker dodge below plus its caps. */
const X_PAD = 26;
const LOG_MIN = Math.log(BUDGETS[0]);
const LOG_SPAN = Math.log(BUDGETS[BUDGETS.length - 1]) - LOG_MIN;
const xScale = (labels: number) =>
  MARGIN.left + X_PAD + ((Math.log(labels) - LOG_MIN) / LOG_SPAN) * (PLOT_W - 2 * X_PAD);
const yScale = (dice: number) => MARGIN.top + (1 - dice) * PLOT_H;
const bottomEdge = MARGIN.top + PLOT_H;

const Y_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];

/**
 * One strip column: the angiogram, optionally one model's mask over it at the
 * selected budget, and the Dice computed for those exact pixels. The painted
 * canvas is cached per mask file, so sliding back is a `drawImage`, not a
 * fresh decode (Figure 2's pattern).
 */
function StripPanel({ budgetIdx, model }: { budgetIdx: number; model: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cache = useRef(new Map<string, HTMLCanvasElement>());
  const strip = STRIP as Strip;
  const mask = model ? strip.budgets[budgetIdx].masks[model] : null;

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

    // Clear first: the previous budget's mask must not linger under this
    // budget's number while the new PNG decodes.
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    paintMaskCanvas(`/research/${mask.file}`, readToken(STRIP_TINTS[model]), mask.vesselIsWhite)
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

  const name = model ? t.modelLabels[model as ModelKey] : t.angioLabel;

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden border border-rule bg-panel">
        {/* Stretched, not cropped: the masks are registered to the squashed
            frame, same ruling as Figure 2's panels. */}
        <img
          src={`/research/${strip.angio}`}
          alt={model ? "" : `${t.angioAltPre}${strip.image}`}
          aria-hidden={model ? true : undefined}
          className="absolute inset-0 h-full w-full"
        />
        {mask && model ? (
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`${t.maskAriaPre}${t.modelLabels[model as ModelKey]}${t.maskAriaMid}${strip.budgets[budgetIdx].labels}${t.maskAriaPost}${mask.dice.toFixed(3)}`}
            className="absolute inset-0 h-full w-full"
          />
        ) : null}
      </div>
      <div className="mt-2 font-mono text-[11px] leading-tight text-mut">
        <span style={model ? { color: SERIES[model as ModelKey].color } : undefined}>{name}</span>
        <br />
        {mask ? `${t.diceLabel} ${mask.dice.toFixed(3)}` : `${t.imagePre}${strip.image}`}
      </div>
    </div>
  );
}

export function LabelEfficiencyFigure() {
  // Default to the smallest budget: the paper's claim lives at 16 labels.
  const [idx, setIdx] = useState(0);
  const labels = BUDGETS[idx];
  const cursorX = xScale(labels);

  const at = (m: ModelKey) => SERIES_POINTS[m][idx];

  // The honest sentence: computed per stop, sign and all. `best` is the top
  // NON-x0 model at this budget; x0 leads at 16 and trails from 32 on.
  const best = MODELS.filter((m) => m !== "x0diffusion").reduce((a, b) =>
    at(a).diceMean >= at(b).diceMean ? a : b,
  );
  const gap = at("x0diffusion").diceMean - at(best).diceMean;

  return (
    <InstrumentFigure
      n="1"
      caption={t.caption}
      readout={`${t.readoutLabel} ${labels}`}
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
              <text x={MARGIN.left - 8} y={yScale(v) + 3} textAnchor="end" fill="currentColor">
                {v.toFixed(1)}
              </text>
            </g>
          ))}

          {BUDGETS.map((b) => (
            <text
              key={b}
              x={xScale(b)}
              y={bottomEdge + 15}
              textAnchor="middle"
              fill="currentColor"
            >
              {b}
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

          {/* The slider's budget, marked across the plot. `data-cursor` is for
              the verify script: ViT's series is also link-blue and dashed, so
              stroke alone no longer identifies the cursor. */}
          <line
            data-cursor
            x1={cursorX}
            x2={cursorX}
            y1={MARGIN.top}
            y2={bottomEdge}
            stroke="var(--color-link)"
            strokeWidth={1.4}
            strokeDasharray="3 3"
          />

          {/* series lines + points */}
          {MODELS.map((m) => (
            <g key={m}>
              <polyline
                points={SERIES_POINTS[m]
                  .map((p) => `${xScale(p.labels)},${yScale(p.diceMean)}`)
                  .join(" ")}
                fill="none"
                stroke={SERIES[m].color}
                strokeWidth={SERIES[m].width}
                strokeDasharray={SERIES[m].dash}
                strokeLinecap="butt"
              />
              {SERIES_POINTS[m].map((p, i) => (
                <circle
                  key={p.labels}
                  cx={xScale(p.labels)}
                  cy={yScale(p.diceMean)}
                  r={i === idx ? 3.4 : 2.2}
                  fill={SERIES[m].color}
                />
              ))}
            </g>
          ))}

          {/* one-standard-deviation whiskers, at the selected budget only —
              seven at every budget is fog. Dodged horizontally in legend
              order (all seven share one x otherwise and smear into a single
              vertical line, seen in the first screenshot pass) and clamped to
              the plot: DeepLabV3's ±0.20 at 16 labels stays inside the axes. */}
          {MODELS.map((m, i) => {
            const p = at(m);
            const x = cursorX + (i - (MODELS.length - 1) / 2) * 6;
            const yTop = yScale(Math.min(1, p.diceMean + p.diceStd));
            const yBot = yScale(Math.max(0, p.diceMean - p.diceStd));
            return (
              <g key={m} data-whisker={m} stroke={SERIES[m].color} strokeOpacity={0.75}>
                <line x1={x} x2={x} y1={yTop} y2={yBot} strokeWidth={1.1} />
                <line x1={x - 3.5} x2={x + 3.5} y1={yTop} y2={yTop} strokeWidth={1.1} />
                <line x1={x - 3.5} x2={x + 3.5} y1={yBot} y2={yBot} strokeWidth={1.1} />
              </g>
            );
          })}

          {/* Legend, line sample + name. Sits in the mid-right band the data
              leaves empty: past 32 labels every trained series is above 0.8
              and ε-diffusion is near 0.23. */}
          {MODELS.map((m, i) => {
            const x = MARGIN.left + PLOT_W * 0.56;
            const y = yScale(0.68) + i * 14;
            return (
              <g key={m}>
                <line
                  x1={x}
                  x2={x + 30}
                  y1={y}
                  y2={y}
                  stroke={SERIES[m].color}
                  strokeWidth={SERIES[m].width}
                  strokeDasharray={SERIES[m].dash}
                />
                <text x={x + 36} y={y + 3.5} fill={SERIES[m].color}>
                  {t.modelLabels[m]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="mt-1 font-mono text-[10.5px] text-mut">
        {t.logNotePre}
        {BUDGETS.map((b, i) => {
          const frac = SERIES_POINTS.x0diffusion[i].fraction;
          return `${i ? (i === BUDGETS.length - 1 ? t.logNoteAnd : ", ") : ""}${b} (${Math.round(frac * 100)}%)`;
        }).join("")}
        {t.logNotePost}
        {effData.trainSize}
        {t.logNoteEnd}
      </p>

      {/* The exact numbers at the cursor, mean ± one standard deviation. */}
      <div
        id="fig-eff-readouts"
        role="status"
        className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[11px] text-mut tabular-nums"
      >
        <span>
          {t.meanPre}
          {labels}
          {t.meanPost}
        </span>
        {MODELS.map((m) => (
          <span key={m} data-model={m}>
            <span style={{ color: SERIES[m].color }}>{t.modelLabels[m]}</span>{" "}
            <span className="text-ink">{at(m).diceMean.toFixed(3)}</span>
            {" ±"}
            {at(m).diceStd.toFixed(3)}
          </span>
        ))}
      </div>

      {/* Lead or trail, computed, never hand-set: the flip at 32 labels is
          the figure's finding. */}
      <p id="fig-eff-gap" className="mt-2 font-mono text-[11px] text-mut tabular-nums">
        {gap >= 0 ? t.gapLeadPre : t.gapTrailPre}
        {t.modelLabels[best]}
        {t.gapMid}
        {Math.abs(gap).toFixed(3)}
        {t.gapPost}
      </p>

      <label
        htmlFor="eff-labels"
        className="mt-4 flex items-center gap-3 font-mono text-[11px] text-mut"
      >
        <span>{t.sliderLabel}</span>
        <input
          id="eff-labels"
          type="range"
          min={0}
          max={BUDGETS.length - 1}
          step={1}
          value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
          aria-label={`${t.sliderAriaPre}${labels}${t.sliderAriaPost}`}
          className="h-1 flex-1 accent-link"
        />
      </label>

      {/* The strip: one real angiogram, then each model's mask at the
          selected budget — the crossover in pixels. Gated on the json block. */}
      {STRIP ? (
        <>
          <div id="fig-eff-strip" className="mt-6 grid grid-cols-3 gap-4">
            <StripPanel budgetIdx={idx} model={null} />
            {STRIP.models.map((m) => (
              <StripPanel key={m} budgetIdx={idx} model={m} />
            ))}
          </div>
          <p className="mt-3 font-mono text-[10.5px] leading-relaxed text-mut">
            {t.stripNotePre}
            {labels}
            {t.stripNotePost}
          </p>
        </>
      ) : null}
    </InstrumentFigure>
  );
}
