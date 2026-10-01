/**
 * Loaders and validators for the SLAAC demo's small public JSON files under
 * public/slaac/ (built by the hand-run scripts/slaac/prepare_nav.py,
 * prepare_launch_sua.py and route_library.py). Never fetches the ONNX model.
 *
 * Same gate discipline as lib/sky-data.ts: any file absent (a failed fetch, a
 * 404) resolves null and the demo stays off; a file that is present and
 * malformed throws, because that is an export bug to see, not hide.
 *
 * Imports only sibling types, so plain node can run the validators.
 */
import type { Meta } from "./sampler.ts";
import type { Fix } from "./reroute.ts";

export type SlaacMeta = Meta & {
  display?: "snapped" | "continuous";
  version?: number;
  model?: string;
  sha256?: string;
  num_types?: number;
  reroute?: Record<string, number>;
};

export type RoutesFile = {
  version: 1;
  lm: { file: string; params: number; temperature: number; top_k: number; max_new: number };
  context: Record<string, number | string>;
  pairs: { origin: string; dest: string; routes: { seed: number; tokens: string[]; fixes: Fix[]; max_leg_nm: number }[] }[];
  dropped: Record<string, number>;
};
export type NavaidsFile = { version: 1; source: string; filter: string; names: string[]; lat: number[]; lon: number[] };
export type AirportsFile = { version: 1; airports: Record<string, { name: string; lat: number; lon: number }> };
export type OutlineFile = { version: 1; lonlat: ([number, number] | null)[] };
// designator is merged_from joined by "+": touching or overlapping rings of one site are
// unioned by prepare_launch_sua.py (owner ruling R7). source is sources[0].
export type LaunchPoly = {
  designator: string; ring: [number, number][]; source: string; clipped: boolean;
  merged_from?: string[]; sources?: string[];
};
export type LaunchSite = {
  id: string; name: string; kind: "charted" | "past-tfr"; label?: string;
  polys: LaunchPoly[]; basis: string;
};
export type LaunchFile = { version: 1; cycle: string; sites: LaunchSite[] };

export type SlaacData = {
  meta: SlaacMeta;
  routes: RoutesFile;
  navaids: NavaidsFile;
  airports: AirportsFile;
  outline: OutlineFile;
  launch: LaunchFile;
};

export const SLAAC_URLS = {
  meta: "/slaac/meta.json",
  routes: "/slaac/routes.json",
  navaids: "/slaac/navaids.json",
  airports: "/slaac/airports.json",
  outline: "/slaac/us-outline.json",
  launch: "/slaac/launch-sua.json",
} as const;

function fail(url: string, what: string): never {
  throw new Error(`${url}: ${what}`);
}
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const numArr = (v: unknown, n?: number): boolean => Array.isArray(v) && v.every(isNum) && (n === undefined || v.length === n);

function obj(v: unknown, url: string): Record<string, unknown> {
  if (!isObj(v)) fail(url, "not an object");
  return v;
}

export function validateMeta(v: unknown): SlaacMeta {
  const url = SLAAC_URLS.meta;
  const m = obj(v, url);
  if (m.version !== 1) fail(url, `version ${String(m.version)}`);
  for (const k of ["channels", "null_type", "sample_size", "res_scale", "xy_scale", "num_types"])
    if (!isNum(m[k])) fail(url, `${k} missing or not a number`);
  if (!isStr(m.model) || !isStr(m.sha256)) fail(url, "model / sha256 missing");
  if (!numArr(m.xy_mean, 2)) fail(url, "xy_mean");
  if (!numArr(m.aux_mean, 4) || !numArr(m.aux_std, 4)) fail(url, "aux_mean / aux_std");
  const sch = obj(m.scheduler, `${url} scheduler`);
  for (const k of ["num_train_timesteps", "solver_order"]) if (!isNum(sch[k])) fail(url, `scheduler.${k}`);
  for (const k of ["beta_schedule", "timestep_spacing", "prediction_type", "algorithm_type", "solver_type", "final_sigmas_type"])
    if (!isStr(sch[k])) fail(url, `scheduler.${k}`);
  if (typeof sch.rescale_betas_zero_snr !== "boolean" || typeof sch.lower_order_final !== "boolean") fail(url, "scheduler flags");
  const s = obj(m.sampler, `${url} sampler`);
  for (const k of ["steps", "guidance", "lowpass_sigma", "sua_strength", "sua_smooth"]) if (!isNum(s[k])) fail(url, `sampler.${k}`);
  const r = obj(m.reroute, `${url} reroute`);
  for (const k of ["sua_snap_tol_nm", "sua_rdp_tol_nm", "sua_spacing_nm", "reroute_dist_nm", "route_radius_nm", "route_min_spacing_nm"])
    if (!isNum(r[k])) fail(url, `reroute.${k}`);
  if (m.display !== undefined && m.display !== "snapped" && m.display !== "continuous") fail(url, "display");
  return m as unknown as SlaacMeta;
}

export function validateNavaids(v: unknown): NavaidsFile {
  const url = SLAAC_URLS.navaids;
  const n = obj(v, url);
  if (n.version !== 1) fail(url, `version ${String(n.version)}`);
  if (!isStr(n.source) || !isStr(n.filter)) fail(url, "source / filter");
  const { names, lat, lon } = n;
  if (!Array.isArray(names) || !names.every((s) => typeof s === "string" && /^[A-Z]{3}$/.test(s))) fail(url, "names");
  if (!numArr(lat, names.length) || !numArr(lon, names.length)) fail(url, "lat / lon length or type");
  return n as unknown as NavaidsFile;
}

export function validateAirports(v: unknown): AirportsFile {
  const url = SLAAC_URLS.airports;
  const a = obj(v, url);
  if (a.version !== 1) fail(url, `version ${String(a.version)}`);
  const aps = obj(a.airports, `${url} airports`);
  if (Object.keys(aps).length === 0) fail(url, "no airports");
  for (const [k, ap] of Object.entries(aps)) {
    const o = obj(ap, `${url} ${k}`);
    if (!isStr(o.name) || !isNum(o.lat) || !isNum(o.lon)) fail(url, `${k} needs name, lat, lon`);
  }
  return a as unknown as AirportsFile;
}

export function validateOutline(v: unknown): OutlineFile {
  const url = SLAAC_URLS.outline;
  const o = obj(v, url);
  if (o.version !== 1) fail(url, `version ${String(o.version)}`);
  if (!Array.isArray(o.lonlat) || o.lonlat.length < 100) fail(url, "lonlat missing or too short");
  for (const p of o.lonlat) if (p !== null && !numArr(p, 2)) fail(url, "lonlat entry is neither null nor a [lon, lat] pair");
  return o as unknown as OutlineFile;
}

export function validateLaunch(v: unknown): LaunchFile {
  const url = SLAAC_URLS.launch;
  const l = obj(v, url);
  if (l.version !== 1) fail(url, `version ${String(l.version)}`);
  if (!isStr(l.cycle)) fail(url, "cycle");
  if (!Array.isArray(l.sites) || l.sites.length === 0) fail(url, "sites");
  for (const s of l.sites) {
    const site = obj(s, `${url} site`);
    if (!isStr(site.id) || !isStr(site.name)) fail(url, "site id / name");
    if (site.kind !== "charted" && site.kind !== "past-tfr") fail(url, `${site.id}: kind`);
    if (site.kind === "past-tfr" && !isStr(site.label)) fail(url, `${site.id}: past-tfr needs a label`);
    if (!isStr(site.basis) || !site.basis.startsWith("https://")) fail(url, `${site.id}: basis`);
    if (!Array.isArray(site.polys) || site.polys.length === 0) fail(url, `${site.id}: polys`);
    for (const p of site.polys) {
      const poly = obj(p, `${url} ${site.id} poly`);
      if (!isStr(poly.designator)) fail(url, `${site.id}: designator`);
      if (!isStr(poly.source) || !poly.source.startsWith("https://")) fail(url, `${site.id} ${poly.designator}: source`);
      if (typeof poly.clipped !== "boolean") fail(url, `${site.id} ${poly.designator}: clipped`);
      if (poly.merged_from !== undefined) {
        const mf = poly.merged_from;
        if (!Array.isArray(mf) || mf.length === 0 || !mf.every(isStr) || mf.join("+") !== poly.designator)
          fail(url, `${site.id} ${poly.designator}: merged_from`);
      }
      if (poly.sources !== undefined) {
        const ss = poly.sources;
        if (!Array.isArray(ss) || ss.length === 0 || !ss.every((u) => isStr(u) && u.startsWith("https://")) || ss[0] !== poly.source)
          fail(url, `${site.id} ${poly.designator}: sources`);
      }
      if (!Array.isArray(poly.ring) || poly.ring.length < 3 || !poly.ring.every((q) => numArr(q, 2)))
        fail(url, `${site.id} ${poly.designator}: ring`);
    }
  }
  return l as unknown as LaunchFile;
}

export function validateRoutes(v: unknown): RoutesFile {
  const url = SLAAC_URLS.routes;
  const r = obj(v, url);
  if (r.version !== 1) fail(url, `version ${String(r.version)}`);
  const lm = obj(r.lm, `${url} lm`);
  if (!isStr(lm.file) || !["params", "temperature", "top_k", "max_new"].every((k) => isNum(lm[k]))) fail(url, "lm");
  obj(r.context, `${url} context`);
  obj(r.dropped, `${url} dropped`);
  if (!Array.isArray(r.pairs) || r.pairs.length === 0) fail(url, "pairs");
  for (const p of r.pairs) {
    const pair = obj(p, `${url} pair`);
    if (!isStr(pair.origin) || !isStr(pair.dest)) fail(url, "pair origin / dest");
    if (!Array.isArray(pair.routes) || pair.routes.length === 0) fail(url, `${pair.origin}-${pair.dest}: routes`);
    for (const rt of pair.routes) {
      const route = obj(rt, `${url} route`);
      if (!isNum(route.seed) || !isNum(route.max_leg_nm)) fail(url, "route seed / max_leg_nm");
      if (!Array.isArray(route.tokens) || !route.tokens.every((t) => typeof t === "string")) fail(url, "route tokens");
      if (!Array.isArray(route.fixes) || route.fixes.length < 2 ||
          !route.fixes.every((f) => Array.isArray(f) && f.length === 3 && typeof f[0] === "string" && isNum(f[1]) && isNum(f[2])))
        fail(url, `${pair.origin}-${pair.dest}: fixes`);
    }
  }
  return r as unknown as RoutesFile;
}

/** Fetch one file: network error or non-OK (a 404) is null, a body that fails `check` throws. */
async function getJson<T>(url: string, check: (v: unknown) => T): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  return check(await res.json());
}

let cache: Promise<SlaacData | null> | null = null;

export function loadSlaacData(): Promise<SlaacData | null> {
  if (cache) return cache;
  cache = (async () => {
    const [meta, routes, navaids, airports, outline, launch] = await Promise.all([
      getJson(SLAAC_URLS.meta, validateMeta),
      getJson(SLAAC_URLS.routes, validateRoutes),
      getJson(SLAAC_URLS.navaids, validateNavaids),
      getJson(SLAAC_URLS.airports, validateAirports),
      getJson(SLAAC_URLS.outline, validateOutline),
      getJson(SLAAC_URLS.launch, validateLaunch),
    ]);
    if (!meta || !routes || !navaids || !airports || !outline || !launch) return null;
    return { meta, routes, navaids, airports, outline, launch };
  })().catch((err) => {
    cache = null;
    throw err;
  });
  return cache;
}
