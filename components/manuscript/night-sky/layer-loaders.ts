import { loadSky } from "@/lib/sky-data";
import { loadIss, MOFFETT_HEIGHT_KM } from "@/lib/sky-iss";
import { MOFFETT } from "@/lib/sky-math";
import { loadMilkyWay, loadObjects, prepareMilkyWay, prepareObjectGlyphs, smallCircle } from "@/lib/sky-objects";
import { precomputeStarFills } from "@/lib/sky-render";
import type { SkyState } from "./state";

/**
 * Every fetch behind the sky, after first paint, each on its own gate
 * (spec 2026-09-15 §9): the star catalog, objects.json, milkyway.json, the
 * ISS's TLE, the sky-facts chunk, and the page font. Absent: the sky draws
 * without that layer. Malformed: logged, never swallowed. Each landing
 * repaints, and nothing lands into a sky that has already unmounted.
 */
export function loadSkyLayers(s: SkyState, deps: { paint: () => void; resolveFont: () => void }) {
  const { paint, resolveFont } = deps;
  const { layers } = s;

  loadSky()
    .then((sky) => {
      if (!s.alive) return;
      s.sky = sky;
      // Once per catalog load, not once per frame: a star's fill colour
      // depends only on its catalog mag/bv, never on time or hover state.
      s.starFills = sky ? precomputeStarFills(sky.stars) : [];
      paint();
    })
    .catch((err) => {
      // A malformed catalog is an export bug; the desk stays plain dark
      // rather than drawing a sky that isn't the real one. Logged on
      // purpose (never swallowed silently): an export bug is something to
      // see, not hide, even though there is no visitor-facing UI for it.
      console.error("NightSky: the star catalog is malformed; the desk stays plain dark.", err);
    });
  // The objects layers, each on its own gate (spec §9).
  loadObjects()
    .then((d) => {
      if (!s.alive) return;
      s.objectsData = d;
      s.objectRings = new Map(
        (d?.objects ?? [])
          .filter((o) => o.symbol === "field" && o.radiusDeg)
          .map((o) => [o.id, smallCircle(o.raDeg, o.decDeg, o.radiusDeg as number)]),
      );
      s.objectGlyphs = prepareObjectGlyphs(d?.objects ?? []);
      layers.objects = d ? "ready" : "absent";
      paint();
    })
    .catch((err) => {
      layers.objects = "error";
      console.error("NightSky: objects.json is malformed; the sky draws without its objects.", err);
      if (s.alive) paint();
    });
  loadMilkyWay()
    .then((d) => {
      if (!s.alive) return;
      s.milkyWay = d ? prepareMilkyWay(d) : null;
      layers.milkyWay = d ? "ready" : "absent";
      paint();
    })
    .catch((err) => {
      layers.milkyWay = "error";
      console.error("NightSky: milkyway.json is malformed; the sky draws without the band.", err);
      if (s.alive) paint();
    });
  loadIss(() => import("satellite.js"), { ...MOFFETT, heightKm: MOFFETT_HEIGHT_KM })
    .then((t) => {
      if (!s.alive) return;
      s.issTracker = t;
      layers.iss = t ? "ready" : "absent";
      paint();
    })
    .catch((err) => {
      layers.iss = "error";
      // Fix round 1: this also catches a failed import("satellite.js")
      // chunk load (loadIss awaits importSatellite() internally), not only
      // a malformed route body, so the message has to be true for both.
      console.error("NightSky: the ISS's TLE or its satellite.js module failed to load; no ISS drawn.", err);
      if (s.alive) paint();
    });
  import("@/content/sky-facts")
    .then(({ SKY_FACTS }) => {
      if (!s.alive) return;
      s.facts = new Map(SKY_FACTS.map((f) => [f.id, f]));
      layers.facts = "ready";
      paint();
    })
    .catch((err) => {
      layers.facts = "error";
      console.error("NightSky: the sky facts chunk failed to load; hover shows names only.", err);
      if (s.alive) paint();
    });
  void document.fonts?.ready.then(() => {
    if (!s.alive) return;
    resolveFont();
    paint();
  });
}
