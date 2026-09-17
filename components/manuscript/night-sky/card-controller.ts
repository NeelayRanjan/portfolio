import type { MutableRefObject, RefObject } from "react";
import { copy } from "@/content/copy";
import { EMISSION_LINE_COLOURED, OBJECT_COLOURS } from "@/lib/sky-layers";
import { PLANETS } from "@/lib/sky-math";
import { constellationAt, type Highlight, type Projected } from "@/lib/sky-render";
import type { CardModel } from "../SkyCard";
import type { SkyState } from "./state";

/**
 * Stargaze cards (spec 2026-09-15 §6): building a card's model from the
 * loaded layers, opening and closing it, and placing it beside its subject
 * every paint. When the subject leaves the viewport the card stays open
 * where it was and says so; only the visitor closes a card (final review F3).
 */

/** Which objects get the card's "symbol not to scale" line ("clutter"
 *  follow-up, 2026-09-15): the enlarged galaxies, nebulae and clusters. The
 *  Milky Way band gets the same note; it isn't an object, so buildCard sets
 *  it directly there instead of through this set. */
const NOT_TO_SCALE_SYMBOLS = new Set(["galaxy", "nebula", "cluster"]);

export type CardControllerDeps = {
  cardRef: RefObject<HTMLElement | null>;
  /** The keyboard-list button that opened the open card, if one did. */
  openerRef: MutableRefObject<HTMLElement | null>;
  /** False for a close that's part of leaving stargaze entirely (fix round 1, I3). */
  focusRestoreRef: MutableRefObject<boolean>;
  setCard: (model: CardModel | null) => void;
  setCardOutOfView: (next: boolean) => void;
  paint: () => void;
};

export type CardController = ReturnType<typeof createCardController>;

export function createCardController(s: SkyState, deps: CardControllerDeps) {
  const { cardRef, openerRef, focusRestoreRef, setCard, setCardOutOfView, paint } = deps;
  /** The open card's offsetWidth/offsetHeight, cached (fix round 1,
   *  promoted minor): followCard reads this instead of the DOM every paint
   *  (~20fps), which would otherwise force a layout outside the measured
   *  frame time. Refreshed by updateCardSize, never read from the DOM
   *  inline in the paint loop. */
  let cardSize: { w: number; h: number } | null = null;
  /** Where followCard last put the card (>=880px), so a card whose subject
   *  has left can stay put, re-clamped to the viewport (F3). */
  let cardPos: { x: number; y: number } | null = null;
  /** Mirrors cardOutOfView state; setState only on a change. */
  let outOfView = false;
  const setOutOfView = (next: boolean) => {
    if (next === outOfView) return;
    outOfView = next;
    setCardOutOfView(next);
  };

  // The only place that reads the card's offsetWidth/offsetHeight off the
  // DOM (fix round 1, promoted minor): called on open, on window resize,
  // and from the card's own ResizeObserver, never from inside followCard.
  const updateCardSize = () => {
    const el = cardRef.current;
    cardSize = el ? { w: el.offsetWidth, h: el.offsetHeight } : null;
  };

  // ---- cards ----
  /** The card's photograph, if the index has one for this id (task 2): the
   *  index entry plus its generation date, which the card cites as the
   *  photograph's access date. Constellations and showers never call this. */
  const imageFor = (id: string): CardModel["image"] | undefined => {
    const im = s.images?.images[id];
    return im ? { ...im, accessed: s.images!.generated } : undefined;
  };
  const buildCard = (h: { kind: Highlight["kind"]; id: string }): CardModel | null => {
    const { sky, objectsData, issTracker, issNow } = s;
    const fact = s.facts?.get(h.id);
    if (!fact || !sky) return null;
    if (h.kind === "constellation") {
      const con = sky.constellations[h.id];
      return con ? { id: h.id, title: con.english ? `${con.latin} (${con.english})` : con.latin, fact, extra: { type: "none" } } : null;
    }
    const shower = objectsData?.showers.find((x) => x.id === h.id);
    if (shower) return { id: h.id, title: shower.name, fact, extra: { type: "shower", shower } };
    const object = objectsData?.objects.find((x) => x.id === h.id);
    if (object) {
      const extra: CardModel["extra"] =
        object.distanceAu !== undefined && object.positionDate
          ? { type: "spacecraft", distanceAu: object.distanceAu, positionDate: object.positionDate }
          : { type: "none" };
      return {
        id: h.id,
        title: object.name,
        fact,
        extra,
        notToScale: NOT_TO_SCALE_SYMBOLS.has(object.symbol),
        // The palette table itself decides, so a colour added or dropped in
        // sky-layers.ts carries its own note with it. M82 is deliberately
        // absent from that table (ruling R-COLOUR-1) and so gets no note.
        colourNote: OBJECT_COLOURS[object.id] !== undefined,
        colourEmissionLines: EMISSION_LINE_COLOURED.has(object.id),
        image: imageFor(h.id),
      };
    }
    const planet = PLANETS.find((name) => name.toLowerCase() === h.id);
    if (planet) return { id: h.id, title: planet, fact, extra: { type: "none" }, image: imageFor(h.id) };
    if (h.id === "moon") return { id: h.id, title: copy.stargaze.card.titleMoon, fact, extra: { type: "none" }, image: imageFor(h.id) };
    if (h.id === "iss" && issTracker && issNow) {
      return {
        id: h.id,
        title: copy.stargaze.card.titleIss,
        fact,
        extra: {
          type: "iss",
          aboveHorizon: issNow.elevationDeg > 0,
          altitudeKm: issNow.altitudeKm,
          speedKmS: issNow.speedKmS,
          epoch: issTracker.tle.epoch,
          still: s.reducedQ.matches,
        },
        image: imageFor(h.id),
      };
    }
    if (h.id === "milky-way") {
      // The band is warmed in stargaze too (task 6), from the same kind of
      // long exposure, so it carries the note as well. It has no palette in
      // OBJECT_COLOURS (its ramp is its own), so it is set here directly,
      // the same way notToScale is. Its colour is star and dust colour, not
      // line emission, so no emission sentence and no Lodriguss citation.
      return {
        id: h.id,
        title: copy.stargaze.card.titleMilkyWay,
        fact,
        extra: { type: "none" },
        notToScale: true,
        colourNote: true,
        image: imageFor(h.id),
      };
    }
    return null;
  };
  const openCard = (h: Highlight) => {
    const model = buildCard(h);
    if (!model) return;
    openerRef.current = null;
    s.selected = { kind: h.kind, id: h.id };
    setCard(model);
    paint();
  };
  const closeCard = (opts?: { restoreFocus?: boolean; byKey?: boolean }) => {
    if (!s.selected) return;
    // Focus moves back only if it was inside the card (F3): a click on
    // empty sky must not yank it from wherever the visitor put it. One
    // exception: Escape with focus on nothing at all (the body, after a
    // mouse drag blurred the card), where leaving it on the body would
    // strand a keyboard user. A close that leaves stargaze mode (NightSky's
    // stargaze subscriber) passes restoreFocus false, since StargazeToggle
    // returns focus to its own entry button then and must not be fought for it.
    const active = document.activeElement;
    const focusInCard = !!(active && cardRef.current?.contains(active));
    const focusNowhere = !active || active === document.body;
    focusRestoreRef.current = (opts?.restoreFocus ?? true) && (focusInCard || (!!opts?.byKey && focusNowhere));
    s.selected = null;
    cardSize = null;
    cardPos = null;
    setOutOfView(false);
    setCard(null);
    paint();
  };
  /** Where a subject is this frame, or null when it is off the viewport. */
  const positionOf = (p: Projected, kind: Highlight["kind"], id: string): { x: number; y: number } | null => {
    if (kind === "constellation") return constellationAt(p, id, s.width, s.height);
    const hit = p.hits.find((h) => h.id === id);
    if (hit) return hit;
    // Below 880px the Milky Way has no hit, only its label point (F6).
    return id === "milky-way" ? p.milkyWay : null;
  };
  const followCard = (p: Projected) => {
    const { width, height } = s;
    const at = s.selected ? positionOf(p, s.selected.kind, s.selected.id) : null;
    // F3: a subject that left the viewport no longer closes its card. The
    // card stops following, stays where it was, and says it's out of view.
    setOutOfView(!at);
    const el = cardRef.current;
    if (!el) return;
    if (s.narrowQ.matches) {
      el.style.left = "";
      el.style.top = "";
      return;
    }
    // Cached by updateCardSize (fix round 1, promoted minor): reading
    // offsetWidth/offsetHeight here, every paint at ~20fps, forces a
    // layout the frame-time measurement never saw. The DOM read is the
    // fallback only for the rare paint that lands before the card's own
    // open effect has cached a size yet.
    if (!cardSize) updateCardSize();
    const w = cardSize?.w ?? el.offsetWidth;
    const h = cardSize?.h ?? el.offsetHeight;
    let x: number;
    let y: number;
    if (at) {
      x = at.x + 18;
      if (x + w > width - 16) x = at.x - 18 - w;
      y = at.y - 24;
    } else if (cardPos) {
      ({ x, y } = cardPos);
    } else {
      return;
    }
    x = Math.min(Math.max(x, 16), width - 16 - w);
    y = Math.min(Math.max(y, 16), height - 16 - h);
    cardPos = { x, y };
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    // Capture phase: Escape closes the card first and never reaches
    // StargazeToggle's exit handler; the next Escape exits stargaze.
    if (e.key !== "Escape" || !s.selected) return;
    e.stopImmediatePropagation();
    closeCard({ byKey: true });
  };

  return {
    buildCard,
    openCard,
    closeCard,
    positionOf,
    followCard,
    updateCardSize,
    onKeyDown,
    isOutOfView: () => outOfView,
  };
}
