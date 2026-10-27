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

/** Chart geometry, in viewBox units. The figure renders TWO layouts of the
 *  same data, chosen by CSS at the site's 880px breakpoint (2026-10-26
 *  audit): the SVG scales to its box, so the desktop layout's 10.5-unit
 *  text came out ~4px tall in a phone's ~280px figure. The narrow layout
 *  is a smaller viewBox with larger type, capped at 400px wide so it never
 *  blows its type up on a tablet, and its legend moves out of the plot to
 *  a list under it (six rows 14 units apart overlapped once scaled down).
 *  The wide layout is the original, unchanged. */
type Geo = {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  /** Inner padding on the x range, so the end budgets don't sit on the y axis
   *  and the right edge, and the shaded column has room either side. */
  xPad: number;
  font: number;
  valueFont: number;
  leadFont: number;
  colHalf: number;
  /** How far ticks and labels sit off their anchors. */
  tickGap: number;
  yTickDy: number;
  xTickDy: number;
  leadDy: number;
  yTitleX: number;
  legendInPlot: boolean;
};
const WIDE: Geo = {
  width: 680,
  height: 320,
  margin: { top: 12, right: 18, bottom: 44, left: 48 },
  xPad: 26,
  font: 10.5,
  valueFont: 13,
  leadFont: 12,
  colHalf: 22,
  tickGap: 8,
  yTickDy: 3,
  xTickDy: 15,
  leadDy: 4,
  yTitleX: 12,
  legendInPlot: true,
};
const NARROW: Geo = {
  width: 360,
  height: 290,
  margin: { top: 14, right: 12, bottom: 50, left: 52 },
  xPad: 22,
  font: 15,
  valueFont: 16,
  leadFont: 15,
  colHalf: 18,
  tickGap: 7,
  yTickDy: 5,
  xTickDy: 20,
  leadDy: 5,
  yTitleX: 15,
  legendInPlot: false,
};

const LOG_MIN = Math.log(BUDGETS[0]);
const LOG_SPAN = Math.log(BUDGETS[BUDGETS.length - 1]) - LOG_MIN;
/** The axis floor. 0.6 clears every displayed mean (the lowest is
 *  DeepLabV3's 0.657 at 16 labels); it was 0.4 while the one-σ whiskers
 *  needed the room, and raising it spreads the lines half again further
 *  apart, which is what makes x0's lead visible. Only the never-drawn
 *  ε-diffusion lives below it. A regenerated export with a mean under 0.6
 *  throws below rather than drawing off the axis. */
const Y_MIN = 0.6;

function scales(g: Geo) {
  const plotW = g.width - g.margin.left - g.margin.right;
  const plotH = g.height - g.margin.top - g.margin.bottom;
  return {
    plotW,
    plotH,
    x: (labels: number) =>
      g.margin.left + g.xPad + ((Math.log(labels) - LOG_MIN) / LOG_SPAN) * (plotW - 2 * g.xPad),
    y: (dice: number) => g.margin.top + ((1 - dice) / (1 - Y_MIN)) * plotH,
    bottomEdge: g.margin.top + plotH,
  };
}

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

/** One layout of the chart. The wide one carries the verify suite's hooks
 *  (`data-series`, `data-eff-*`); the narrow one carries the same marks under
 *  a `-narrow` suffix, so the suite can hold both to the json. */
function Chart({ g, narrow }: { g: Geo; narrow: boolean }) {
  const sc = scales(g);
  const sfx = narrow ? "-narrow" : "";
  const lowX = sc.x(BUDGETS[0]);
  const x0Y = sc.y(X0_LOW.diceMean);
  const runnerY = sc.y(RUNNER_LOW.diceMean);
  const bracketX = lowX + 9;
  const hook = (name: string, value: string | boolean = "") => ({ [`data-${name}${sfx}`]: value });

  return (
    <svg
      viewBox={`0 0 ${g.width} ${g.height}`}
      className="w-full"
      role="img"
      aria-label={t.chartAria}
      fontSize={g.font}
    >
      {/* The smallest budget's column, where the claim lives, shaded in
          x0's own green. */}
      <rect
        {...hook("eff-highlight")}
        x={lowX - g.colHalf}
        y={g.margin.top}
        width={g.colHalf * 2}
        height={sc.plotH}
        fill="var(--color-ok)"
        fillOpacity={0.08}
      />

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
          <text x={g.margin.left - g.tickGap} y={sc.y(v) + g.yTickDy} textAnchor="end" fill="currentColor">
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      {BUDGETS.map((b) => (
        <text
          key={b}
          x={sc.x(b)}
          y={sc.bottomEdge + g.xTickDy}
          textAnchor="middle"
          fill="currentColor"
        >
          {b}
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

      {/* series lines + points, x0 on top and at full strength */}
      {DRAW_ORDER.map((m) => {
        const isX0 = m === "x0diffusion";
        return (
          <g key={m} {...hook("series", m)} opacity={isX0 ? 1 : BASELINE_OPACITY}>
            <polyline
              points={SERIES_POINTS[m]
                .map((p) => `${sc.x(p.labels)},${sc.y(p.diceMean)}`)
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
                cx={sc.x(p.labels)}
                cy={sc.y(p.diceMean)}
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
        {...hook("eff-x0-value")}
        x={lowX - 10}
        y={x0Y - 11}
        fill="var(--color-ok)"
        fontSize={g.valueFont}
        fontWeight={600}
      >
        {t.modelLabels.x0diffusion} {X0_LOW.diceMean.toFixed(3)}
      </text>
      {LEAD > 0 ? (
        <g {...hook("eff-lead")} stroke="var(--color-ok)" strokeWidth={1.2}>
          <line x1={bracketX} x2={bracketX} y1={x0Y + 5} y2={runnerY} />
          <line x1={bracketX - 3} x2={bracketX + 3} y1={runnerY} y2={runnerY} />
          <text
            x={bracketX + 6}
            y={(x0Y + runnerY) / 2 + g.leadDy}
            fill="var(--color-ok)"
            stroke="none"
            fontSize={g.leadFont}
            fontWeight={600}
          >
            +{LEAD.toFixed(3)}
          </text>
        </g>
      ) : null}

      {/* Legend, line sample + name, in the lower-right band the data
          leaves empty (right of 32 labels every series is above 0.83).
          The narrow layout lists it under the chart instead. */}
      {g.legendInPlot
        ? MODELS.map((m, i) => {
            const x = g.margin.left + sc.plotW * 0.56;
            const y = sc.y(0.79) + i * 14;
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
          })
        : null}
    </svg>
  );
}

export function LabelEfficiencyFigure() {
  return (
    <InstrumentFigure n="1" id="fig-eff" caption={t.caption}>
      <div className="text-mut font-mono">
        {/* Wide first in the DOM: it is the layout the suite's original
            hooks read. `hidden` removes the other one from the
            accessibility tree too, so a screen reader meets one chart. */}
        <div className="hidden min-[880px]:block">
          <Chart g={WIDE} narrow={false} />
        </div>
        <div className="mx-auto max-w-[400px] min-[880px]:hidden">
          <Chart g={NARROW} narrow />
          <ul
            data-eff-legend-narrow
            aria-hidden
            className="mt-2 grid grid-cols-1 justify-between gap-x-3 min-[380px]:grid-cols-[auto_auto] gap-y-1.5 text-[11px]"
          >
            {MODELS.map((m) => (
              <li
                key={m}
                className="flex items-center gap-1.5 whitespace-nowrap"
                style={{ color: SERIES[m].color }}
              >
                {/* Only the sample fades with its line; the name stays at full
                    colour, or SAM's red falls to ~3.1:1. */}
                <svg
                  width="20"
                  height="6"
                  aria-hidden
                  className="shrink-0"
                  opacity={m === "x0diffusion" ? 1 : BASELINE_OPACITY}
                >
                  <line
                    x1="0"
                    x2="20"
                    y1="3"
                    y2="3"
                    stroke={SERIES[m].color}
                    strokeWidth={SERIES[m].width}
                    strokeDasharray={SERIES[m].dash}
                  />
                </svg>
                {t.modelLabels[m]}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-2 font-mono text-[11px] text-mut min-[880px]:mt-1 min-[880px]:text-[10.5px]">
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
