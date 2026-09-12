import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { copy } from "@/content/copy";
import data from "@/public/research/label_efficiency.json";

/**
 * Figure 2 — label efficiency, computed from the paper's real per-image
 * metrics (`scripts/prepare-research.mjs` aggregates
 * `all_metrics_combined_long.csv` and asserts the headline number before
 * writing `label_efficiency.json`). Server component: the JSON is a build-time
 * import, not a fetch, so this never ships a loading state.
 *
 * Geometry is derived from the data, not hardcoded, so a re-export changes
 * the chart with no edit here:
 * - x domain is the real `labels` values every model shares (16/32/80).
 * - y domain pads slightly around the real min/max `diceMean` across every
 *   model and fraction.
 * - y-axis ticks are drawn from the ACTUAL diceMean values in the file
 *   (spread across the sorted unique set), never round numbers a chart
 *   library would invent.
 * - End-of-line labels are placed at each model's last (80-label) point,
 *   then decluttered with a minimum vertical gap so the six baselines
 *   clustered between 0.83 and 0.92 Dice don't overlap into one smear.
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
const modelLabels: Record<string, string> = copy.research.efficiency.modelLabels;

const WIDTH = 680;
const HEIGHT = 340;
const MARGIN = { top: 16, right: 150, bottom: 40, left: 40 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const MIN_LABEL_GAP = 13;

const allRows = modelKeys.flatMap((key) => models[key]);
const xValues = Array.from(new Set(allRows.map((r) => r.labels))).sort((a, b) => a - b);
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

// End-of-line label positions: start at each model's last point, then
// declutter with a minimum vertical gap (sorted pass + clamp back inside
// the plot if the stack overflows the bottom).
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

export function EfficiencyFigure() {
  return (
    <InstrumentFigure n="2" caption={copy.research.efficiency.caption}>
      <div className="text-mut font-mono text-[10.5px]">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={copy.research.efficiency.caption}
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
            {copy.research.efficiency.xAxisLabel}
          </text>

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
    </InstrumentFigure>
  );
}
