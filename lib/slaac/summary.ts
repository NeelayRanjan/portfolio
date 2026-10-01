/** Figure 3's all-flights summary (Task 12c): the handful of numbers that
 *  stand in for a 373-row table. Pure, no imports, so plain node pins it
 *  (scripts/test-slaac-summary.mjs).
 *
 *  - checked: every flight the press sent.
 *  - affected: every flight the rerouter touched (not "untouched").
 *  - rerouted: affected flights whose plan clears ("ok"); cannotClear the rest.
 *  - medians and the worst added distance: over rerouted flights only. A
 *    cannot-clear plan's added distance isn't a reroute's cost, and an
 *    untouched flight adds nothing by construction.
 *  - minClearanceNm: the lowest over affected flights, so a cannot-clear
 *    (0 nm) counts; belowMargin when it is under the run's margin. */
export type FlightLike = {
  status: "ok" | "untouched" | "cannot-clear";
  metrics: { addedNm: number; addedPct: number; minClearanceNm: number | null };
};

export type FlightSummary = {
  checked: number;
  affected: number;
  rerouted: number;
  cannotClear: number;
  medianAddedNm: number | null;
  medianAddedPct: number | null;
  maxAddedNm: number | null;
  /** The % of the flight whose added distance is the worst. */
  maxAddedPct: number | null;
  minClearanceNm: number | null;
  belowMargin: boolean;
};

/** Signed to `digits`, with anything that rounds to zero printed as a bare
 *  zero: -0.004 must not read "-0.0" (nor +0.004 "+0.0"). The figure's one
 *  formatter for added distance; the verify suite builds its expected
 *  strings with it too. */
export function fmtSigned(n: number, digits: number): string {
  const s = n.toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits);
  return n > 0 ? `+${s}` : s;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export function summarizeFlights(flights: FlightLike[], marginNm: number): FlightSummary {
  const affected = flights.filter((f) => f.status !== "untouched");
  const ok = affected.filter((f) => f.status === "ok");
  let worst: FlightLike | null = null;
  for (const f of ok) if (!worst || f.metrics.addedNm > worst.metrics.addedNm) worst = f;
  let minC: number | null = null;
  for (const f of affected) {
    const c = f.metrics.minClearanceNm;
    if (c !== null && (minC === null || c < minC)) minC = c;
  }
  return {
    checked: flights.length,
    affected: affected.length,
    rerouted: ok.length,
    cannotClear: affected.length - ok.length,
    medianAddedNm: median(ok.map((f) => f.metrics.addedNm)),
    medianAddedPct: median(ok.map((f) => f.metrics.addedPct)),
    maxAddedNm: worst ? worst.metrics.addedNm : null,
    maxAddedPct: worst ? worst.metrics.addedPct : null,
    minClearanceNm: minC,
    belowMargin: minC !== null && minC < marginNm,
  };
}
