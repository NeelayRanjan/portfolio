"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy";
import type { LanderModelView } from "@/lib/lander-types";

/**
 * The model's side of Figure 5: what the lander module's `onModel` reports,
 * drawn as a chart in the craft's own frame, metres both ways. Nothing here is
 * scenery. The dots are the 64 ground samples of the dream's terrain-context
 * strip (2 m apart, flagged scanned or hazard exactly as the model is given
 * them); the dotted line is the last second of flight the model starts from;
 * each green line is one predicted 3 s future.
 *
 * ⚠️ The ground's wording follows `ground.read`. An autopilot plan gives the
 * dream every command, so the dream does NOT read the strip for those
 * futures (lunar_lander src/model/dream.ts: the context is set only when some
 * command is dropped); the planner checks each predicted path against the
 * real ground and the hazards it has scanned. Manual futures do read it. The
 * label says which, and must never claim the plan's futures saw the ground.
 *
 * The x range is the strip's own (±64 m), so the ground always fills the
 * width; y fits the ground and the paths, on 5 m steps so the axis doesn't
 * twitch at every update (about two a second).
 *
 * The chunking (owner, 2026-10-16: "make chunking visible"): the autopilot
 * plans 3 s ahead and flies only the first `execS` (0.5 s) of the chosen
 * plan before the next plan is due. In metres that chunk is ~2.5 m, a few
 * pixels across ±64 m, so a second panel puts it on a TIME axis (−3 s to
 * +3 s, height relative to now): the chunk flying now (thick), the rest of
 * the plan that will be replaced (dashed), the chunks earlier plans flew
 * (one per plan, alternating shades, from each view's `origin`), and the
 * actual flight (dotted). Gaps between consecutive chunks are real: where a
 * plan predicted the craft would be versus where the next plan found it.
 * `execS` is the on-time schedule; a late reply keeps the previous plan
 * flying longer, which the chunks then show as a longer stretch.
 */
const PAD = { l: 34, r: 10, t: 30, b: 22 };
/** How far back the time panel and its chunk history reach (s). */
const HISTORY_S = 3;
type Pt = { t: number; y: number };
type Chunk = { t0: number; pts: Pt[] };
interface History { view: LanderModelView | null; real: Pt[]; chunks: Chunk[] }

/** Fold a new view into the history: the real flight from its 1 s `past`,
 *  and (a plan) the chosen path's first `execS` as one chunk. A new flight,
 *  a switch between plan and futures, or a gap resets it. */
function absorb(m: History, view: LanderModelView): void {
  const prev = m.view;
  if (!prev || view.source !== prev.source || view.t < prev.t - 1e-6 || view.t - prev.t > 2) {
    m.real = [];
    m.chunks = [];
  }
  m.view = view;
  const n = view.past.length / 2;
  for (let k = 0; k < n; k++) {
    const t = view.t - (n - 1 - k) * view.dt;
    const last = m.real[m.real.length - 1];
    if (!last || t > last.t + 1e-6) m.real.push({ t, y: view.origin.y + view.past[2 * k + 1] });
  }
  m.real = m.real.filter((p) => p.t >= view.t - HISTORY_S - 0.5);
  if (view.execS !== null) {
    const chosen = view.paths.find((p) => p.tier === "chosen");
    if (chosen) {
      const steps = Math.round(view.execS / view.dt);
      const pts: Pt[] = [];
      for (let k = 0; k <= steps && 2 * k + 1 < chosen.xy.length; k++) pts.push({ t: view.t + k * view.dt, y: view.origin.y + chosen.xy[2 * k + 1] });
      m.chunks.push({ t0: view.t, pts });
    }
    m.chunks = m.chunks.filter((ch) => ch.t0 >= view.t - HISTORY_S - 0.5);
  }
}
const X_SPAN = 64;

function niceRange(lo: number, hi: number): [number, number] {
  const a = Math.floor((lo - 2) / 5) * 5;
  const b = Math.ceil((hi + 2) / 5) * 5;
  return b - a < 15 ? [a, a + 15] : [a, b];
}

function pathD(xy: Float32Array, X: (m: number) => number, Y: (m: number) => number): string {
  let d = "";
  for (let i = 0; i < xy.length; i += 2) d += `${i === 0 ? "M" : "L"}${X(xy[i]).toFixed(1)} ${Y(xy[i + 1]).toFixed(1)}`;
  return d;
}

const TIER_ORDER = { rejected: 0, sample: 1, elite: 2, chosen: 3 } as const;
const TIER_STYLE = {
  rejected: { opacity: 0.16, width: 1 },
  sample: { opacity: 0.4, width: 1 },
  elite: { opacity: 0.45, width: 1.2 },
  chosen: { opacity: 1, width: 2.2 },
} as const;

/** `simplePilot`: the planner's last rung is flying (no model in the loop),
 *  so the chart says so instead of holding the last plan it saw. */
export function LanderModelChart({ view: given, simplePilot = false }: { view: LanderModelView | null; simplePilot?: boolean }) {
  const view = simplePilot ? null : given;
  const c = copy.systems.lander.chart;
  const boxRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = w > 0 && w < 520;
  const h = narrow ? 170 : 200;
  // Side by side from 700px (the space view the wider), stacked below.
  const side = w >= 700;
  const sw = side ? Math.round(w * 0.6) : w;
  const tw = side ? w - sw - 1 : w;
  const th = side ? h : 140;
  const hist = useRef<History>({ view: null, real: [], chunks: [] });
  if (view && hist.current.view !== view) absorb(hist.current, view);

  let body: React.ReactNode = null;
  if (view && w > 0) {
    const g = view.ground;
    let lo = Infinity;
    let hi = 0;
    for (let i = 0; i < g.y.length; i++) lo = Math.min(lo, g.y[i]);
    for (const p of view.paths) for (let i = 1; i < p.xy.length; i += 2) {
      lo = Math.min(lo, p.xy[i]);
      hi = Math.max(hi, p.xy[i]);
    }
    for (let i = 1; i < view.past.length; i += 2) hi = Math.max(hi, view.past[i]);
    const [y0, y1] = niceRange(lo, hi);
    const X = (m: number) => PAD.l + ((m + X_SPAN) / (2 * X_SPAN)) * (sw - PAD.l - PAD.r);
    const Y = (m: number) => PAD.t + ((y1 - m) / (y1 - y0)) * (h - PAD.t - PAD.b);
    const ticksY = [y0, Math.round((y0 + y1) / 2 / 5) * 5, y1].filter((v, i, a) => a.indexOf(v) === i);
    const paths = [...view.paths].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
    const tx = Math.max(-X_SPAN, Math.min(X_SPAN, view.targetX));
    const targetOff = Math.abs(view.targetX) > X_SPAN;
    // A flag's label that would run past the panel's right edge goes on its left (9px mono, ~5.6px a character).
    const flipTarget = X(tx) + 12 + 5.6 * c.target.length > sw - PAD.r;
    const ty = Math.max(y0, Math.min(y1, g.y[Math.max(0, Math.min(g.y.length - 1, Math.round(tx / 2 + 31.5)))]));
    body = (
      <>
        {[-48, -32, -16, 0, 16, 32, 48].map((m) => (
          <line key={`gx${m}`} x1={X(m)} x2={X(m)} y1={PAD.t} y2={h - PAD.b} className="stroke-rule" strokeWidth={m === 0 ? 1 : 0.6} />
        ))}
        {ticksY.map((m) => (
          <g key={`gy${m}`}>
            <line x1={PAD.l} x2={sw - PAD.r} y1={Y(m)} y2={Y(m)} className="stroke-rule" strokeWidth={0.6} />
            <text x={PAD.l - 5} y={Y(m) + 3} textAnchor="end" className="fill-mut">{m}</text>
          </g>
        ))}
        <text x={X(-X_SPAN)} y={h - 6} className="fill-mut">−64 m</text>
        <text x={X(0)} y={h - 6} textAnchor="middle" className="fill-mut">{c.craft}</text>
        <text x={X(X_SPAN)} y={h - 6} textAnchor="end" className="fill-mut">+64 m</text>
        {Array.from(g.x, (gx, i) => {
          const x = X(gx);
          const y = Y(g.y[i]);
          if (g.hazard[i] && g.scanned[i])
            return <path key={i} d={`M${x - 2.6} ${y - 2.6}l5.2 5.2m0 -5.2l-5.2 5.2`} className="stroke-red-ink" strokeWidth={1.3} />;
          return g.scanned[i] ? (
            <circle key={i} cx={x} cy={y} r={1.9} className="fill-ink" fillOpacity={0.7} />
          ) : (
            <circle key={i} cx={x} cy={y} r={1.9} fill="none" className="stroke-mut" strokeWidth={0.9} />
          );
        })}
        <g className="fill-warm">
          {targetOff ? (
            <path d={view.targetX > 0 ? `M${sw - PAD.r} ${Y(ty)}l-9 -5v10z` : `M${PAD.l} ${Y(ty)}l9 -5v10z`} />
          ) : (
            <path d={`M${X(tx)} ${Y(ty)}v-16l10 4l-10 4z`} />
          )}
          {Math.abs(view.targetX) < 8 ? null : (
          <text
            x={targetOff ? (view.targetX > 0 ? sw - PAD.r - 12 : PAD.l + 12) : flipTarget ? X(tx) - 4 : X(tx) + 12}
            y={Y(ty) - (targetOff ? 8 : 12)}
            textAnchor={(targetOff && view.targetX > 0) || (!targetOff && flipTarget) ? "end" : "start"}
          >
            {c.target}
            {targetOff ? ` ${view.targetX > 0 ? "+" : "−"}${Math.round(Math.abs(view.targetX))} m` : ""}
          </text>
          )}
        </g>
        <path d={pathD(view.past, X, Y)} fill="none" className="stroke-ink" strokeWidth={1.4} strokeDasharray="2 3" />
        <g fill="none" className="stroke-ok">
          {paths.map((p, i) => {
            if (p.tier !== "chosen" || view.execS === null) {
              return <path key={i} d={pathD(p.xy, X, Y)} strokeOpacity={TIER_STYLE[p.tier].opacity} strokeWidth={TIER_STYLE[p.tier].width} />;
            }
            // The chosen plan: the chunk flown now, thick; the rest, which the
            // next plan replaces, dashed.
            const cut = Math.min(p.xy.length, 2 * (Math.round(view.execS / view.dt) + 1));
            return (
              <g key={i}>
                <path d={pathD(p.xy.subarray(cut - 2), X, Y)} strokeWidth={1.3} strokeDasharray="4 3" strokeOpacity={0.85} />
                <path d={pathD(p.xy.subarray(0, cut), X, Y)} strokeWidth={3.2} strokeLinecap="round" />
              </g>
            );
          })}
        </g>
        {paths.map((p, i) => {
          if (!p.contact) return null;
          const n = p.xy.length;
          return (
            <circle
              key={`c${i}`}
              cx={X(p.xy[n - 2])}
              cy={Y(p.xy[n - 1])}
              r={p.tier === "chosen" ? 3 : 2}
              className={p.contact === "safe" ? "fill-ok" : "fill-red-ink"}
              fillOpacity={TIER_STYLE[p.tier].opacity}
            />
          );
        })}
        <circle cx={X(0)} cy={Y(0)} r={4} className="fill-ok" />
        <g className="fill-mut">
          <circle cx={PAD.l + 8} cy={14} r={1.9} className="fill-ink" fillOpacity={0.7} />
          <text x={PAD.l + 15} y={17}>{c.scanned}</text>
          <circle cx={PAD.l + 76} cy={14} r={1.9} fill="none" className="stroke-mut" strokeWidth={0.9} />
          <text x={PAD.l + 83} y={17}>{c.unscanned}</text>
          <path d={`M${PAD.l + 136} 11.4l5.2 5.2m0 -5.2l-5.2 5.2`} className="stroke-red-ink" strokeWidth={1.2} />
          <text x={PAD.l + 146} y={17}>{c.hazard}</text>
        </g>
      </>
    );
  }

  let timeline: React.ReactNode = null;
  if (view && w > 0) timeline = <ChunkTimeline view={view} hist={hist.current} width={tw} height={th} />;

  const label = view?.source === "futures" ? c.labelFutures : c.labelPlan;
  const ground = view?.ground.read ? c.groundRead : c.groundChecked;
  return (
    <div data-lander-chart={view ? view.source : simplePilot ? "simple-pilot" : "waiting"} className="mt-4">
      <p className="mb-1.5 font-mono text-[11px] text-ok">
        {label}
        {view ? <span className="text-mut"> · {ground}</span> : null}
      </p>
      {view?.execS != null ? <ChunkLegend execS={view.execS} /> : null}
      <div ref={boxRef} className="w-full border border-rule bg-desk/40">
        {view ? (
          <div className={side ? "flex" : "flex flex-col"}>
          <svg
            width={sw}
            height={h}
            role="img"
            aria-label={c.aria}
            className="block font-mono text-[9px]"
            data-lander-chart-paths={view.paths.length}
          >
            {body}
          </svg>
          <div className={side ? "w-px bg-rule" : "h-px bg-rule"} />
          {timeline}
          </div>
        ) : (
          // One line, not the chart's full height (round 2, 2026-10-27): an
          // empty 200px box under the scene read as broken while the model
          // loaded. The chart takes its height when the first view lands.
          <p className="px-3 py-2.5 font-mono text-[11px] text-mut">
            {simplePilot ? c.simplePilot : c.waiting}
          </p>
        )}
      </div>
    </div>
  );
}

/** The chunk key, above the chart (HTML, so it wraps on a phone). */
function ChunkLegend({ execS }: { execS: number }) {
  const c = copy.systems.lander.chart;
  const item = (svg: React.ReactNode, text: string) => (
    <span className="inline-flex items-center gap-1.5">
      <svg width="22" height="8" aria-hidden="true" className="stroke-ok">{svg}</svg>
      {text}
    </span>
  );
  return (
    <p data-lander-chunk-legend className="mb-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-mut">
      {item(<line x1="1" x2="21" y1="4" y2="4" strokeWidth="3.2" strokeLinecap="round" />, `${c.flyingNowPre}${execS}${c.flyingNowPost}`)}
      {item(<line x1="1" x2="21" y1="4" y2="4" strokeWidth="1.3" strokeDasharray="4 3" />, c.rest)}
      {item(<><line x1="1" x2="10" y1="4" y2="4" strokeWidth="2" strokeOpacity="0.85" /><line x1="11" x2="21" y1="4" y2="4" strokeWidth="2" strokeOpacity="0.45" /></>, c.earlier)}
      {item(<line x1="1" x2="21" y1="4" y2="4" className="stroke-ink" strokeWidth="1.4" strokeDasharray="2 3" />, c.actual)}
    </p>
  );
}

/** Height over time, −3 s to +3 s around the newest plan: where the chunks
 *  show. For manual futures (no chunks) it shows the sampled futures' heights. */
function ChunkTimeline({ view, hist, width, height }: { view: LanderModelView; hist: History; width: number; height: number }) {
  const c = copy.systems.lander.chart;
  const L = 30;
  const R = 8;
  const T = 18;
  const B = 20;
  const now = view.t;
  const oy = view.origin.y;
  const chosen = view.paths.find((p) => p.tier === "chosen");
  const samples = view.execS === null ? view.paths : [];
  let lo = 0;
  let hi = 0;
  const see = (y: number) => {
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  };
  for (const p of hist.real) if (p.t >= now - HISTORY_S) see(p.y - oy);
  for (const ch of hist.chunks) for (const p of ch.pts) if (p.t >= now - HISTORY_S) see(p.y - oy);
  for (const p of chosen ? [chosen] : samples) for (let i = 1; i < p.xy.length; i += 2) see(p.xy[i]);
  const [y0, y1] = niceRange(lo, hi);
  const X = (t: number) => L + ((t - now + HISTORY_S) / (2 * HISTORY_S)) * (width - L - R);
  const Y = (m: number) => T + ((y1 - m) / (y1 - y0)) * (height - T - B);
  const line = (pts: Pt[]) => pts.filter((p) => p.t >= now - HISTORY_S).map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)} ${Y(p.y - oy).toFixed(1)}`).join("");
  const future = (xy: Float32Array, from = 0, to = xy.length) => {
    let d = "";
    for (let i = from; i < to; i += 2) d += `${i === from ? "M" : "L"}${X(now + (i / 2) * view.dt).toFixed(1)} ${Y(xy[i + 1]).toFixed(1)}`;
    return d;
  };
  const cut = chosen && view.execS !== null ? Math.min(chosen.xy.length, 2 * (Math.round(view.execS / view.dt) + 1)) : 0;
  const ticks: number[] = [];
  for (let k = -2 * HISTORY_S; k <= 2 * HISTORY_S; k++) ticks.push(now + k * 0.5);
  return (
    <svg width={width} height={height} role="img" aria-label={c.timeAria} className="block font-mono text-[9px]" data-lander-timeline>
      <text x={L} y={12} className="fill-mut">{c.timeTitle}</text>
      {ticks.map((t, k) => (
        <line key={k} x1={X(t)} x2={X(t)} y1={T} y2={height - B} className="stroke-rule" strokeWidth={Math.abs(t - now) < 1e-6 ? 1 : 0.5} />
      ))}
      {[y0, y1].map((m) => (
        <text key={m} x={L - 4} y={Y(m) + 3} textAnchor="end" className="fill-mut">{m}</text>
      ))}
      <text x={X(now - HISTORY_S)} y={height - 6} className="fill-mut">−{HISTORY_S} s</text>
      <text x={X(now)} y={height - 6} textAnchor="middle" className="fill-mut">{c.now}</text>
      <text x={X(now + HISTORY_S)} y={height - 6} textAnchor="end" className="fill-mut">+{HISTORY_S} s</text>
      <path d={line(hist.real)} fill="none" className="stroke-ink" strokeWidth={1.4} strokeDasharray="2 3" />
      <g fill="none" className="stroke-ok">
        {samples.map((p, i) => <path key={i} d={future(p.xy)} strokeWidth={1} strokeOpacity={0.4} />)}
        {hist.chunks.slice(0, -1).map((ch, i, all) => (
          <path key={ch.t0} data-lander-chunk="past" d={line(ch.pts)} strokeWidth={2.2} strokeLinecap="round" strokeOpacity={(all.length - i) % 2 ? 0.85 : 0.45} />
        ))}
      </g>
      {/* Where each plan took over: one mark per chunk, so the joins show
          even when the chunks run on as one smooth line. */}
      <g className="fill-ok">
        {hist.chunks.map((ch) =>
          ch.t0 >= now - HISTORY_S && ch.pts.length ? (
            <rect key={`m${ch.t0}`} x={X(ch.t0) - 0.75} y={Y(ch.pts[0].y - oy) - 5} width={1.5} height={10} fillOpacity={0.9} />
          ) : null,
        )}
      </g>
      <g fill="none" className="stroke-ok">
        {chosen && cut ? (
          <>
            <path data-lander-chunk="rest" d={future(chosen.xy, cut - 2)} strokeWidth={1.3} strokeDasharray="4 3" strokeOpacity={0.85} />
            <path data-lander-chunk="now" d={future(chosen.xy, 0, cut)} strokeWidth={3.2} strokeLinecap="round" />
          </>
        ) : null}
      </g>
      <circle cx={X(now)} cy={Y(0)} r={3.5} className="fill-ok" />
    </svg>
  );
}
