/** The route-level pipeline, ported from sua_guidance.py (_apex_between,
 *  _snap_or_raw, _fill_ceiling, _densify_leg, prune_bypassable, refine_route_sua,
 *  _leg_affected, local_reroute) and plan_cli.py's metrics (fixes_to_m,
 *  path_len_nm, leg_crossings, min_clearance_nm). Points are Albers metres,
 *  fixes are [name, lat, lon]. Control flow follows the Python statement for
 *  statement; where numpy picks the first of equal values (argmin/argmax), so
 *  does this. */
import { albers, inverseAlbers, NM } from "./albers.ts";
import {
  type Pt, type Poly, segCrossesPoly, segIllegal, ptIllegal, distToSuaNm, rdpMask,
} from "./geometry.ts";
import type { Navaids } from "./navaids.ts";

export type Fix = [name: string, lat: number, lon: number];
export type Role = "filed" | "deviation" | "rejoin";
/** The diffusion model scoped to one entry->rejoin arc: (N,2) Albers metres. */
export type ArcSampler = (entryLL: [number, number], rejoinLL: [number, number], polys: Poly[]) => Pt[];

export type RefineOpts = {
  wpdb: Navaids | null; snapTolNm: number; maxPasses?: number;
  maxLegNm?: number | null; rdpTolNm?: number | null; clearMarginNm: number;
};
export type RerouteOpts = {
  wpdb: Navaids | null; lockDistNm: number; snapTolNm: number; devSpacingNm: number | null;
  rdpTolNm: number | null; hug: boolean; hugMarginNm: number; clearMarginNm: number;
};

const toM = (f: Fix): Pt => albers(f[1], f[2]);

function argminDist(dense: Pt[], p: Pt): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < dense.length; i++) {
    const dx = dense[i][0] - p[0], dy = dense[i][1] - p[1];
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** np.linspace(0, 1, num): i * (1 / (num - 1)), the last forced to exactly 1. */
function linspace01(num: number): number[] {
  const step = 1.0 / (num - 1);
  const out: number[] = [];
  for (let i = 0; i < num; i++) out.push(i * step);
  out[num - 1] = 1.0;
  return out;
}

/** _snap_or_raw: the nearest in-tolerance named fix that clears every polygon by
 *  marginM, and whose legs to prevM/nextM (when given) clear them too; else a raw
 *  BEND at the point. The BEND's own legs are not re-checked (the repair loop's job). */
function snapOrRaw(ptM: Pt, wpdb: Navaids | null, polys: Poly[], snapTolNm: number,
  prevM: Pt | null, nextM: Pt | null, marginM: number, k = 16): Fix {
  if (wpdb !== null && wpdb.length) {
    const { idx, dist } = wpdb.kNearest(ptM, Math.min(k, wpdb.length));
    const R = snapTolNm * NM;
    for (let n = 0; n < idx.length; n++) {
      if (dist[n] > R) break;                       // sorted: nothing else is in tol
      const i = idx[n];
      const cand = wpdb.point(i);
      if (ptIllegal(cand, polys, marginM)) continue;
      if (prevM !== null && segIllegal(prevM, cand, polys, marginM)) continue;
      if (nextM !== null && segIllegal(cand, nextM, polys, marginM)) continue;
      return [String(wpdb.names[i]), wpdb.lat[i], wpdb.lon[i]];
    }
  }
  const [la, lo] = inverseAlbers(ptM[0], ptM[1]);
  return ["BEND", la, lo];
}

/** _apex_between: the dense path's farthest point from the chord A->B, snapped. */
function apexBetween(Am: Pt, Bm: Pt, dense: Pt[], polys: Poly[], wpdb: Navaids | null,
  snapTolNm: number, marginM: number): Fix | null {
  const iA = argminDist(dense, Am), iB = argminDist(dense, Bm);
  const lo = Math.min(iA, iB), hi = Math.max(iA, iB);
  if (hi - lo < 2) return null;
  const abx = Bm[0] - Am[0], aby = Bm[1] - Am[1];
  const L = Math.hypot(abx, aby) + 1e-9;
  let best = lo, bp = -Infinity;
  for (let i = lo; i <= hi; i++) {
    const perp = Math.abs((dense[i][0] - Am[0]) * aby - (dense[i][1] - Am[1]) * abx) / L;
    if (perp > bp) { bp = perp; best = i; }
  }
  return snapOrRaw(dense[best], wpdb, polys, snapTolNm, Am, Bm, marginM);
}

/** np.searchsorted(d, target), side="left": the first i with d[i] >= target. */
function searchsortedLeft(d: number[], target: number): number {
  let lo = 0, hi = d.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (d[mid] < target) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** _fill_ceiling: split any kept gap longer than stepM along-track. */
function fillCeiling(idxs: number[], d: number[], stepM: number): number[] {
  const out = [idxs[0]];
  for (let k = 1; k < idxs.length; k++) {
    const a = idxs[k - 1], b = idxs[k];
    const gap = d[b] - d[a];
    if (gap > stepM) {
      const n = Math.floor(gap / stepM);
      for (let s = 1; s <= n; s++) {
        const target = d[a] + s * stepM;
        if (target >= d[b]) break;
        out.push(searchsortedLeft(d, target));
      }
    }
    out.push(b);
  }
  return out;
}

/** _densify_leg: RDP turn points plus a maxLegNm ceiling along the dense path
 *  between A and B, each snapped; repeated named fixes are deduplicated. */
function densifyLeg(A: Fix, B: Fix, dense: Pt[], polys: Poly[], wpdb: Navaids | null, snapTolNm: number,
  maxLegNm: number | null | undefined, rdpTolNm: number | null | undefined, marginM: number): Fix[] {
  const Am = toM(A), Bm = toM(B);
  const iA = argminDist(dense, Am), iB = argminDist(dense, Bm);
  const lo = Math.min(iA, iB), hi = Math.max(iA, iB);
  if (hi - lo < 2) return [];
  let seg = dense.slice(lo, hi + 1);
  if (iA > iB) seg = seg.reverse();
  const d = [0.0];
  for (let i = 1; i < seg.length; i++) {
    const dx = seg[i][0] - seg[i - 1][0], dy = seg[i][1] - seg[i - 1][1];
    d.push(d[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  let idxs: number[];
  if (rdpTolNm) {
    const keep = rdpMask(seg, rdpTolNm * NM);
    idxs = [];
    for (let i = 0; i < keep.length; i++) if (keep[i]) idxs.push(i);
  } else {
    idxs = [0, seg.length - 1];
  }
  if (maxLegNm) idxs = fillCeiling(idxs, d, maxLegNm * NM);
  const kept = idxs.slice(1, -1);
  const mids: Fix[] = [];
  let last = A[0];
  let prevM = Am;
  for (let pos = 0; pos < kept.length; pos++) {
    const nxtM = pos + 1 < kept.length ? seg[kept[pos + 1]] : Bm;
    const f = snapOrRaw(seg[kept[pos]], wpdb, polys, snapTolNm, prevM, nxtM, marginM);
    if (f[0] === "BEND" || f[0] !== last) {        // keep all BENDs; dedup a repeated named fix
      mids.push(f); last = f[0];
      prevM = albers(f[1], f[2]);
    }
  }
  return mids;
}

/** prune_bypassable: drop interior fixes whose neighbours join with a legal leg,
 *  to a fixpoint; the endpoints are never touched. */
export function pruneBypassable(pts: Fix[], polys: Poly[], marginM = 0): Fix[] {
  if (!polys.length || pts.length < 3) return [...pts];
  const out = [...pts];
  let changed = true;
  while (changed && out.length >= 3) {
    changed = false;
    let i = 1;
    while (i < out.length - 1) {
      if (!segIllegal(toM(out[i - 1]), toM(out[i + 1]), polys, marginM)) {
        out.splice(i, 1);
        changed = true;
      } else {
        i += 1;
      }
    }
  }
  return out;
}

/** refine_route_sua: make a sparse plan legal against the dense avoided path.
 *  Drop illegal interior fixes, repair with apex inserts (budgeted, strictly
 *  improving), densify, prune, then re-repair to a fixpoint. */
export function refineRouteSua(route: Fix[], dense: Pt[], polys: Poly[], opts: RefineOpts): Fix[] {
  const { wpdb, snapTolNm, maxLegNm = null, rdpTolNm = null } = opts;
  const maxPasses = opts.maxPasses ?? 6;
  if (!polys.length || route.length < 2) return route;
  const marginM = opts.clearMarginNm * NM;

  const nBad = (pts: Fix[]) => {
    let n = 0;
    for (let j = 0; j + 1 < pts.length; j++) if (segIllegal(toM(pts[j]), toM(pts[j + 1]), polys, marginM)) n++;
    return n;
  };

  // The budget and the strict-improvement test stop an unsatisfiable leg (an anchor
  // inside the margin) from growing a BEND chain forever; the caller sees the residual.
  const repair = (ptsIn: Fix[], budget: number): Fix[] => {
    let pts = ptsIn;
    let best = nBad(pts);
    for (let pass = 0; pass < maxPasses; pass++) {
      if (best === 0 || pts.length > budget) break;
      const res: Fix[] = [pts[0]];
      let changed = false;
      for (let j = 0; j + 1 < pts.length; j++) {
        const A = pts[j], B = pts[j + 1];
        const Am = toM(A), Bm = toM(B);
        if (segIllegal(Am, Bm, polys, marginM)) {
          const ins = apexBetween(Am, Bm, dense, polys, wpdb, snapTolNm, marginM);
          if (ins !== null) { res.push(ins); changed = true; }
        }
        res.push(B);
      }
      if (!changed) break;
      const nb = nBad(res);
      if (nb >= best) break;                          // no progress: the leg is unsatisfiable
      pts = res; best = nb;
    }
    return pts;
  };

  let pts: Fix[] = [route[0], ...route.slice(1, -1).filter((f) => !ptIllegal(toM(f), polys, marginM)), route[route.length - 1]];
  const budget = Math.max(3 * route.length, 24);
  pts = repair(pts, budget);

  if (maxLegNm || rdpTolNm) {
    const dpts: Fix[] = [pts[0]];
    for (let j = 0; j + 1 < pts.length; j++) {
      dpts.push(...densifyLeg(pts[j], pts[j + 1], dense, polys, wpdb, snapTolNm, maxLegNm, rdpTolNm, marginM));
      dpts.push(pts[j + 1]);
    }
    pts = dpts;
  }

  pts = pruneBypassable(pts, polys, marginM);

  // densify and prune ran after repair certified the plan; either can reintroduce
  // an illegal leg, so re-repair to a fixpoint under the same budget.
  for (let pass = 0; pass < maxPasses; pass++) {
    const before = pts.length;
    pts = pruneBypassable(repair(pts, budget + pts.length), polys, marginM);
    if (pts.length === before) break;
  }
  return pts;
}

/** _leg_affected: the straight leg crosses a polygon or passes within distNm
 *  (24 samples along it, endpoints included). */
function legAffected(A: Fix, B: Fix, polys: Poly[], distNm: number): boolean {
  const Am = toM(A), Bm = toM(B);
  if (polys.some((P) => segCrossesPoly(Am, Bm, P))) return true;
  for (const t of linspace01(24)) {
    const p: Pt = [Am[0] * (1 - t) + Bm[0] * t, Am[1] * (1 - t) + Bm[1] * t];
    if (distToSuaNm(p, polys) <= distNm) return true;
  }
  return false;
}

/** local_reroute's walk over the filed route, with the deviation step injected.
 *  localReroute passes the real sampler+refine; anchorsFor passes a recorder. */
function walk(nominal: Fix[], polys: Poly[], opts: RerouteOpts,
  dev: (entry: Fix, rejoin: Fix) => Fix[]): { plan: Fix[]; roles: Role[] } {
  const n = nominal.length;
  if (!polys.length || n < 2) return { plan: [...nominal], roles: nominal.map(() => "filed" as const) };
  const cm = opts.clearMarginNm * NM;

  if (opts.hug) {
    const affLeg: boolean[] = [];
    for (let i = 0; i < n - 1; i++) affLeg.push(legAffected(nominal[i], nominal[i + 1], polys, opts.hugMarginNm));
    const plan: Fix[] = [nominal[0]];
    const roles: Role[] = ["filed"];
    let i = 0;
    while (i < n - 1) {
      if (affLeg[i]) {
        let p = i;
        while (p < n - 1 && affLeg[p]) p += 1;       // p = first fix past the affected run
        // ANCHOR ADVANCEMENT: walk each anchor outward along the filed route until it
        // clears the margin (or the route ends and the caller gets the residual).
        // Pinned assumption: with hugMarginNm == clearMarginNm (the demo's single margin
        // control), an anchor bordering an unaffected leg already sits beyond the margin,
        // so these two loops are unreachable in practice. Ported faithfully regardless.
        while (p < n - 1 && ptIllegal(toM(nominal[p]), polys, cm)) p += 1;
        while (plan.length > 1 && ptIllegal(toM(plan[plan.length - 1]), polys, cm)) { plan.pop(); roles.pop(); }
        const entry = plan[plan.length - 1], rejoin = nominal[p];
        for (const f of dev(entry, rejoin).slice(1, -1)) { plan.push(f); roles.push("deviation"); }
        plan.push(rejoin); roles.push("rejoin");
        i = p;                                        // interior fixes (inside the box) dropped
      } else {
        plan.push(nominal[i + 1]); roles.push("filed");
        i += 1;
      }
    }
    return { plan, roles };
  }

  // wide berth: the berth can never be tighter than the clearance the plan must honour
  const lock = Math.max(opts.lockDistNm, opts.clearMarginNm);
  const clearWp = nominal.map((f) => distToSuaNm(toM(f), polys) > lock);
  const affLeg: boolean[] = [];
  for (let i = 0; i < n - 1; i++) affLeg.push(legAffected(nominal[i], nominal[i + 1], polys, lock));
  const affWp = nominal.map((_, i) => !clearWp[i] || (i > 0 ? affLeg[i - 1] : false) || (i < n - 1 ? affLeg[i] : false));
  affWp[0] = false; affWp[n - 1] = false;

  const plan: Fix[] = [];
  const roles: Role[] = [];
  let i = 0;
  while (i < n) {
    if (!affWp[i]) {
      plan.push(nominal[i]); roles.push("filed"); i += 1;
    } else {
      let j = i;
      while (j < n && affWp[j]) j += 1;
      const entry = plan[plan.length - 1], rejoin = nominal[j];
      for (const f of dev(entry, rejoin).slice(1, -1)) { plan.push(f); roles.push("deviation"); }
      plan.push(rejoin); roles.push("rejoin");
      i = j + 1;
    }
  }
  return { plan, roles };
}

/** local_reroute: keep the filed route, generate only each entry->rejoin arc. */
export function localReroute(nominal: Fix[], polys: Poly[], sampler: ArcSampler, opts: RerouteOpts): { plan: Fix[]; roles: Role[] } {
  return walk(nominal, polys, opts, (entry, rejoin) => {
    const arc = sampler([entry[1], entry[2]], [rejoin[1], rejoin[2]], polys);
    return refineRouteSua([entry, rejoin], arc, polys, {
      wpdb: opts.wpdb, snapTolNm: opts.snapTolNm, maxLegNm: opts.devSpacingNm,
      rdpTolNm: opts.rdpTolNm, clearMarginNm: opts.clearMarginNm,
    });
  });
}

/** The (entry, rejoin) pairs localReroute will hand the sampler, in order, without
 *  sampling. Exact in both modes, because an anchor never depends on sampler output:
 *  - wide: entry is plan[-1], always a filed fix or a rejoin (deviation fixes are
 *    always followed by their rejoin).
 *  - hug: the only way sampler output could matter is the entry pop loop reaching a
 *    previous arc's deviation fixes, which needs that arc's rejoin to be illegal. The
 *    rejoin advancement leaves nominal[p] legal unless p == n-1, and p == n-1 ends the
 *    walk, so no later arc exists. This walk runs with no deviation fixes in the plan
 *    and assumes no pop reaches one; if that ever failed, a later entry here could
 *    differ from the real one. A caller must not depend on this list being exhaustive:
 *    the worker samples on demand for any (entry, rejoin) it did not plan. */
export function anchorsFor(nominal: Fix[], polys: Poly[], opts: RerouteOpts): { entry: Fix; rejoin: Fix }[] {
  const out: { entry: Fix; rejoin: Fix }[] = [];
  walk(nominal, polys, opts, (entry, rejoin) => { out.push({ entry, rejoin }); return [entry, rejoin]; });
  return out;
}

// ---- plan_cli metrics -------------------------------------------------------

function pathLenNm(xy: Pt[]): number {
  if (xy.length < 2) return 0.0;
  let s = 0;
  for (let i = 1; i < xy.length; i++) {
    const dx = xy[i][0] - xy[i - 1][0], dy = xy[i][1] - xy[i - 1][1];
    s += Math.sqrt(dx * dx + dy * dy);
  }
  return s / NM;
}

/** Straight legs of the emitted plan that touch any polygon. THE metric. */
function legCrossings(fixes: Fix[], polys: Poly[]): number {
  const xy = fixes.map(toM);
  let n = 0;
  for (let i = 0; i + 1 < xy.length; i++) if (polys.some((P) => segCrossesPoly(xy[i], xy[i + 1], P))) n++;
  return n;
}

/** Closest approach of the plan (flown as straight legs, 32 samples each). */
function minClearanceNm(fixes: Fix[], polys: Poly[], perLeg = 32): number {
  if (!polys.length) return Infinity;
  const xy = fixes.map(toM);
  let best = Infinity;
  const ts = linspace01(perLeg);
  for (let i = 0; i + 1 < xy.length; i++) {
    const a = xy[i], b = xy[i + 1];
    for (const t of ts) {
      best = Math.min(best, distToSuaNm([a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t], polys));
      if (best === 0.0) return 0.0;
    }
  }
  return best;
}

/** plan_cli's per-plan numbers, unrounded (the caller formats them). */
export function metrics(nominal: Fix[], plan: Fix[], polys: Poly[]): {
  nominalNm: number; planNm: number; addedNm: number; addedPct: number; legCrossings: number; minClearanceNm: number | null;
} {
  const nominalNm = pathLenNm(nominal.map(toM));
  const planNm = pathLenNm(plan.map(toM));
  const clr = minClearanceNm(plan, polys);
  return {
    nominalNm, planNm, addedNm: planNm - nominalNm,
    addedPct: nominalNm ? (100.0 * (planNm - nominalNm)) / nominalNm : 0.0,
    legCrossings: legCrossings(plan, polys),
    minClearanceNm: Number.isFinite(clr) ? clr : null,
  };
}
