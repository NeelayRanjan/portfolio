import type { SkyFact } from "@/content/sky-facts";
import type { SkyData } from "@/lib/sky-data";
import type { IssLook, IssTracker } from "@/lib/sky-iss";
import type { ObjectGlyph, PreparedMilkyWay, SkyObjectsData } from "@/lib/sky-objects";
import { PAPER_SATURATION } from "@/lib/sky-colour";
import type { Vec } from "@/lib/sky-pan";
import type { Highlight, Projected } from "@/lib/sky-render";

/**
 * The mutable state NightSky's effect shares between its modules (the
 * painter, the frame loop, the card controller, the keyboard list, the
 * pointer controller and the layer loaders). Before the split these were
 * `let` bindings in one effect closure; they live on one plain object now so
 * every module reads and writes the same value, exactly as the closure did.
 * State a single module owns stays private to that module's factory.
 */

export type LayerState = "loading" | "ready" | "absent" | "error";

export type SkyLayers = { objects: LayerState; milkyWay: LayerState; facts: LayerState; iss: LayerState };

// Drag to pan. `offset` slides the whole chart (lib/sky-math.ts chartFor);
// `velocity` is the return spring's, px/s.
export type Drag = { id: number; startX: number; startY: number; base: Vec; moved: boolean };

export type SkyState = {
  readonly narrowQ: MediaQueryList;
  readonly reducedQ: MediaQueryList;
  /** A device with no hover (a phone): paper mode never lifts to full colour. */
  readonly noHoverQ: MediaQueryList;
  readonly loadMs: number;
  alive: boolean;
  sky: SkyData | null;
  starFills: string[];
  objectsData: SkyObjectsData | null;
  objectRings: Map<string, [number, number][]>;
  objectGlyphs: ReadonlyMap<string, ObjectGlyph>;
  milkyWay: PreparedMilkyWay | null;
  facts: Map<string, SkyFact> | null;
  readonly layers: SkyLayers;
  issTracker: IssTracker | null;
  /** The ISS as of the last paint. */
  issNow: IssLook | null;
  width: number;
  height: number;
  projected: Projected | null;
  fontFamily: string;
  /** The frame loop is running (false under reduced motion). */
  running: boolean;
  highlight: Highlight | null;
  /** The open card's subject; mirrors `card` state, readable synchronously. */
  selected: { kind: Highlight["kind"]; id: string } | null;
  drag: Drag | null;
  offset: Vec;
  velocity: Vec;
  springing: boolean;
  springLast: number;
  /** The sourced colour's current saturation, 0..1, as drawn (lib/sky-colour.ts). */
  saturation: number;
  /** Where `saturation` is easing to. */
  saturationTarget: number;
  /** rAF timestamp of the last ease step; 0 when the ease is at rest. */
  saturationLast: number;
  /** Paper mode: the pointer is over the sky itself, not the sheet, a
   *  control or the credit. */
  pointerOverSky: boolean;
};

export function createSkyState(): SkyState {
  return {
    narrowQ: window.matchMedia("(max-width: 879px)"),
    reducedQ: window.matchMedia("(prefers-reduced-motion: reduce)"),
    noHoverQ: window.matchMedia("(hover: none)"),
    loadMs: Date.now(),
    alive: true,
    sky: null,
    starFills: [],
    objectsData: null,
    objectRings: new Map(),
    objectGlyphs: new Map(),
    milkyWay: null,
    facts: null,
    layers: { objects: "loading", milkyWay: "loading", facts: "loading", iss: "loading" },
    issTracker: null,
    issNow: null,
    width: 0,
    height: 0,
    projected: null,
    fontFamily: "monospace",
    running: false,
    highlight: null,
    selected: null,
    drag: null,
    offset: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    springing: false,
    springLast: 0,
    saturation: PAPER_SATURATION,
    saturationTarget: PAPER_SATURATION,
    saturationLast: 0,
    pointerOverSky: false,
  };
}
