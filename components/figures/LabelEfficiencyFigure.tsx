import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { copy } from "@/content/copy";
import effData from "@/public/research/label_efficiency.json";

/**
 * Figure 1 — the label-efficiency chart: mean test Dice vs label budget from
 * `public/research/label_efficiency.json`, which `scripts/prepare-research.mjs`
 * pools from the paper's own metrics CSV (2,500 per-image predictions per
 * point: all seeds, all folds, all 100 test images). This is the graph the
 * site's headline number lives in: 0.882 is the x0-diffusion point at 16
 * labels.
 *
 * STATIC since 2026-09-30 (owner call: the slider, readouts, whiskers and
 * mask strip were hurting engagement more than helping). It is a server
 * component now, no client JS. What replaced the interaction is emphasis on
 * the one thing the figure argues: x0-diffusion drawn heavy and the
 * baselines faded, the smallest budget's column shaded in x0's green, x0's
 * value printed on its point, and a bracket from the next-best model up to
 * x0 labelled with the lead. The `strip` block and its `eff/` masks stay in
 * the json and in public/research/, unrendered (same as the wipe's assets);
 * git history has the interactive version.
 *
 * ⚠️ EVERYTHING IS READ FROM THE FILE, including the annotation: the value,
 * the next-best model and the lead are computed at the smallest budget, so a
 * regenerated export moves them with no code edit. If x0 ever stops leading
 * there, the bracket and lead label are not drawn (the figure never asserts
 * a win the data doesn't show).
 *
 * ⚠️ SAM'S LINE IS FLAT BECAUSE THE DATA IS. SAM is zero-shot and never
 * trains on the labels; the CSV replicates its 2,500 per-image scores at
 * every fraction. Don't de-duplicate it out of the chart.
 *
 * ⚠️ THE X AXIS IS LOG-SPACED (a mono note under the chart says so). Budgets
 * 16→32→80 are multiplicative steps; linear spacing shoves 16 and 32
 * together and makes the crossover look later than it is.
 *
 * ⚠️ COLOR IS NEVER THE ONLY CARRIER (house rule): every series has its own
 * dash pattern and a named legend entry, and Figure 2's three hues (green
 * x0, dashed red SAM, dotted amber ResNet-UNet) are kept identical here.
 */

type Point = { fraction: number; labels: number; diceMean: number; diceStd: number; n: number };
type ModelKey = keyof typeof effData.models;

const t = copy.research.figLabelEff;

/** Display order: descending mean at the smallest budget, so the legend reads
 *  top-to-bottom the way the left edge of the chart does.
 *
 *  ⚠️ ε-DIFFUSION IS DELIBERATELY NOT DISPLAYED (owner call, 2026-09-13): its
 *  flat ~0.23 line pinned the y axis to zero and squashed the 0.65-0.95 band
 *  where every difference lives. It stays in the json and the caption
 *  discloses the omission with its number. Y_MIN below exists because of it. */
const MODELS: ModelKey[] = [
  "x0diffusion",
  "sam",
  "vit_base_patch16",
  "hybridresnetvit",
  "resnet",
  "deeplabv3",
];
const BASELINES = MODELS.filter((m) => m !== "x0diffusion");

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

/** Line style per model. Figure 2's three series keep exactly its hues and
 *  dashes; x0 is drawn heavier here because it is the figure's subject. */
const SERIES: Record<ModelKey, { color: string; dash?: string; width: number }> = {
  x0diffusion: { color: "var(--color-ok)", width: 2.8 },
  sam: { color: "var(--color-red-ink)", dash: "7 4", width: 1.6 },
  resnet: { color: "var(--color-warm)", dash: "1.6 3.2", width: 1.6 },
  vit_base_patch16: { color: "var(--color-link)", dash: "10 3", width: 1.4 },
  hybridresnetvit: { color: "var(--color-mut)", dash: "5 3", width: 1.2 },
  deeplabv3: { color: "var(--color-mut)", width: 1.2 },
  ediffusion: { color: "var(--color-mut)", dash: "1.6 3.2", width: 1.2 },
};
/** How far the baselines fade behind x0. Still legible (their crossover at
 *  32 and 80 labels is part of the story), just not competing. */
const BASELINE_OPACITY = 0.5;

/** The annotation, computed at the smallest budget. */
const X0_LOW = SERIES_POINTS.x0diffusion[0];
const RUNNER_UP = BASELINES.reduce((a, b) =>
  SERIES_POINTS[a][0].diceMean >= SERIES_POINTS[b][0].diceMean ? a : b,
);
const RUNNER_LOW = SERIES_POINTS[RUNNER_UP][0];
const LEAD = X0_LOW.diceMean - RUNNER_LOW.diceMean;

const WIDTH = 680;
const HEIGHT = 320;
const MARGIN = { top: 12, right: 18, bottom: 44, left: 48 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

/** Inner padding on the x range, so the end budgets don't sit on the y axis
 *  and the right edge, and the shaded column has room either side. */
const X_PAD = 26;
const LOG_MIN = Math.log(BUDGETS[0]);
const LOG_SPAN = Math.log(BUDGETS[BUDGETS.length - 1]) - LOG_MIN;
const xScale = (labels: number) =>
  MARGIN.left + X_PAD + ((Math.log(labels) - LOG_MIN) / LOG_SPAN) * (PLOT_W - 2 * X_PAD);
/** The axis floor. 0.6 clears every displayed mean (the lowest is
 *  DeepLabV3's 0.657 at 16 labels); it was 0.4 while the one-σ whiskers
 *  needed the room, and raising it spreads the lines half again further
 *  apart, which is what makes x0's lead visible. Only the never-drawn
 *  ε-diffusion lives below it. A regenerated export with a mean under 0.6
 *  throws below rather than drawing off the axis. */
const Y_MIN = 0.6;
const yScale = (dice: number) => MARGIN.top + ((1 - dice) / (1 - Y_MIN)) * PLOT_H;
const bottomEdge = MARGIN.top + PLOT_H;

const Y_TICKS = [0.6, 0.7, 0.8, 0.9, 1];
for (const m of MODELS) {
  for (const p of SERIES_POINTS[m]) {
    if (p.diceMean < Y_MIN) {
      throw new Error(`label_efficiency.json: ${m} at ${p.labels} labels is ${p.diceMean}, under the axis floor ${Y_MIN}`);
    }
  }
}

/** Series draw order: baselines first, x0 last, so it sits on top. */
const DRAW_ORDER: ModelKey[] = [...BASELINES, "x0diffusion"];

export function LabelEfficiencyFigure() {
  const lowX = xScale(BUDGETS[0]);
  const x0Y = yScale(X0_LOW.diceMean);
  const runnerY = yScale(RUNNER_LOW.diceMean);
  const bracketX = lowX + 9;

  return (
    <InstrumentFigure n="1" id="fig-eff" caption={t.caption}>
      <div className="text-mut font-mono text-[10.5px]">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={t.chartAria}>
          {/* The smallest budget's column, where the claim lives, shaded in
              x0's own green. */}
          <rect
            data-eff-highlight
            x={lowX - 22}
            y={MARGIN.top}
            width={44}
            height={PLOT_H}
            fill="var(--color-ok)"
            fillOpacity={0.08}
          />

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

          {/* series lines + points, x0 on top and at full strength */}
          {DRAW_ORDER.map((m) => {
            const isX0 = m === "x0diffusion";
            return (
              <g key={m} data-series={m} opacity={isX0 ? 1 : BASELINE_OPACITY}>
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
                    r={isX0 ? (i === 0 ? 4.6 : 3.4) : 2.2}
                    fill={SERIES[m].color}
                  />
                ))}
              </g>
            );
          })}

          {/* x0's value on its smallest-budget point, and (only while it
              actually leads there) a bracket down to the next-best model
              carrying the lead. */}
          <text
            data-eff-x0-value
            x={lowX - 10}
            y={x0Y - 11}
            fill="var(--color-ok)"
            fontSize={13}
            fontWeight={600}
          >
            {t.modelLabels.x0diffusion} {X0_LOW.diceMean.toFixed(3)}
          </text>
          {LEAD > 0 ? (
            <g data-eff-lead stroke="var(--color-ok)" strokeWidth={1.2}>
              <line x1={bracketX} x2={bracketX} y1={x0Y + 5} y2={runnerY} />
              <line x1={bracketX - 3} x2={bracketX + 3} y1={runnerY} y2={runnerY} />
              <text
                x={bracketX + 6}
                y={(x0Y + runnerY) / 2 + 4}
                fill="var(--color-ok)"
                stroke="none"
                fontSize={12}
                fontWeight={600}
              >
                +{LEAD.toFixed(3)}
              </text>
            </g>
          ) : null}

          {/* Legend, line sample + name, in the lower-right band the data
              leaves empty (right of 32 labels every series is above 0.83). */}
          {MODELS.map((m, i) => {
            const x = MARGIN.left + PLOT_W * 0.56;
            const y = yScale(0.79) + i * 14;
            return (
              <g key={m} opacity={m === "x0diffusion" ? 1 : 0.75}>
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
    </InstrumentFigure>
  );
}
