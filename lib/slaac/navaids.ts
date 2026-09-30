/** The snap table (waypoint_snap.WaypointDB), with cKDTree's k-nearest query
 *  replaced by an exact brute-force search. ~1,400 fixes, so a linear scan per
 *  query is cheap and needs no tree. */
import { albers } from "./albers.ts";
import type { Pt } from "./geometry.ts";

export class Navaids {
  readonly names: string[];
  readonly lat: number[];
  readonly lon: number[];
  /** Albers metres, interleaved [x0, y0, x1, y1, ...]. */
  readonly xy: Float64Array;

  constructor(names: string[], lat: number[], lon: number[]) {
    if (names.length !== lat.length || names.length !== lon.length) throw new Error("Navaids: column lengths differ");
    this.names = names; this.lat = lat; this.lon = lon;
    this.xy = new Float64Array(names.length * 2);
    for (let i = 0; i < names.length; i++) {
      const [x, y] = albers(lat[i], lon[i]);
      this.xy[2 * i] = x; this.xy[2 * i + 1] = y;
    }
  }

  get length(): number { return this.names.length; }

  point(i: number): Pt { return [this.xy[2 * i], this.xy[2 * i + 1]]; }

  /** cKDTree.query(p, k): exact Euclidean distances, ascending, ties broken by
   *  lower index. Keeps a sorted top-k by insertion, so one pass over the table. */
  kNearest(p: Pt, k: number): { idx: number[]; dist: number[] } {
    const kk = Math.min(k, this.names.length);
    const idx: number[] = [], dist: number[] = [];
    for (let i = 0; i < this.names.length; i++) {
      const dx = p[0] - this.xy[2 * i], dy = p[1] - this.xy[2 * i + 1];
      const d = Math.sqrt(dx * dx + dy * dy);
      if (dist.length === kk && d >= dist[kk - 1]) continue; // equal distance: the lower index already holds it
      let j = dist.length;
      while (j > 0 && dist[j - 1] > d) j--;                  // strict: an equal earlier index stays ahead
      dist.splice(j, 0, d); idx.splice(j, 0, i);
      if (dist.length > kk) { dist.pop(); idx.pop(); }
    }
    return { idx, dist };
  }
}
