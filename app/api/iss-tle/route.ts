/**
 * The ISS's two-line element set for the night sky (spec
 * docs/superpowers/specs/2026-09-15-sky-objects-design.md §8), same-origin
 * and cached, so a visitor's browser never contacts a third party and
 * CelesTrak sees this site at most once per revalidation window (their
 * fair-use guidance asks for no more than one download per two hours).
 *
 * `revalidate` works here because this project does not enable
 * cacheComponents (node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/route.md, "Revalidating Cached Data"). Every failure,
 * including a reply that isn't a valid ISS TLE, answers 200 with
 * `{ tle: null }`: the cached body then carries no TLE, the next
 * revalidation tries again, and the client (lib/sky-iss.ts) simply draws no
 * ISS.
 */
import { parseTleText, tleEpochIso } from "@/lib/sky-iss";

export const revalidate = 7200;

const SOURCE = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE";

export async function GET() {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(SOURCE, {
      headers: { "user-agent": "neelayranjan.dev night sky (ISS position, cached 2 h)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return Response.json({ tle: null, fetchedAt });
    const tle = parseTleText(await res.text());
    if (!tle) return Response.json({ tle: null, fetchedAt });
    return Response.json({ ...tle, epoch: tleEpochIso(tle.line1), fetchedAt });
  } catch {
    return Response.json({ tle: null, fetchedAt });
  }
}
