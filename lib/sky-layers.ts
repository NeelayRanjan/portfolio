/**
 * The night sky's objects layers (spec
 * docs/superpowers/specs/2026-09-15-sky-objects-design.md §4): the Milky Way
 * band, the deep-sky and landmark symbols, the named stars' names, the Voyager
 * chevrons and the active meteor-shower radiants. Pure drawing, called by
 * lib/sky-render.ts drawSky in the spec's back-to-front order; every function
 * returns the Hits it drew so NightSky can hit-test exactly what is on screen.
 *
 * Colours are the site tokens: ink and mut at low alpha for natural things,
 * warm for human-made things and radiants, matching the planets. No red.
 *
 * Proper nouns ("Milky Way") are rendered straight from data or literals, the
 * way sky-render.ts renders planet names; they are names, not prose.
 */
import type {
  ClusterGlyph,
  DustLane,
  GalaxyGlyph,
  NebulaGlyph,
  ObjectGlyph,
  PreparedMilkyWay,
  SkyObject,
  SkyShower,
  TintedPlaced,
} from "./sky-objects";
import { SPIRAL_DR, SPIRAL_R0, SPIRAL_TURNS } from "./sky-objects";
import { project, type Chart, type Equatorial } from "./sky-math";
import { bandMix, lerpNum, lerpRgb, saturateRgb } from "./sky-colour";

/** A rectangle, CSS px, top-left + size. */
export type Box = { x: number; y: number; w: number; h: number };
/**
 * A selectable thing as drawn this frame, CSS px. `name` is its label.
 * `box` is where its always-on name sits (final review F1): a click inside
 * it selects the thing, before any radius test, so "click a name" is true.
 * It is reported whenever names are on (>=880px), even while the name
 * itself is suppressed under a hover label, so hovering a name can't make
 * its own hit target vanish on the next pointer move. `boxOnly` hits (the
 * Milky Way, F6) have no symbol, so they are selectable by the box alone.
 * `core` overrides lib/sky-render.ts's default on-symbol radius
 * (SYMBOL_CORE_PX) for a glyph drawn bigger than that default ("clutter"
 * follow-up, 2026-09-15: the enlarged galaxies/nebulae/clusters); every
 * other symbol leaves it unset and keeps the default.
 */
export type Hit = { id: string; name: string; x: number; y: number; box?: Box; boxOnly?: boolean; core?: number };

const INK = "234,229,218";
const MUT = "154,148,138";
const WARM = "217,164,91";
const D2R = Math.PI / 180;

/** Sourced long-exposure colours, "r,g,b" so each draw site picks its own
 *  alpha (same shape as INK/MUT/WARM). Drawn at FULL strength while
 *  stargazing or while the pointer is over the sky, and mixed toward each
 *  colour's own luminance in paper mode (View.saturation, `paletteFor`
 *  below). Sources:
 *  .superpowers/sdd/colour-sources.md.
 *
 *  ⚠️ The contract: every entry here traces to a sentence on a page that
 *  THIS object's card cites. It was false for ten objects until 2026-09-16
 *  (final review C1: the pre-existing cards were coloured without anyone
 *  touching their citation lists), so it is now machine-checked rather than
 *  promised, by COLOUR_CITATION in scripts/test-sky-objects.mjs, which maps
 *  each id here to the URL its palette rests on and fails if that URL is
 *  missing from the card. Adding a palette means fetching a source and citing
 *  it on the card. An id absent from this table draws grey. */
export type ObjectPalette = {
  /** Body/cloud fill. */ base: string;
  /** Core, bulge or inner region where the structure has one. */ core?: string;
  /** Arms, rim, filaments, knots or a jet where the structure has one. */ accent?: string;
  /** A SECOND accent, only where a source names two distinct minority
   *  colours in one object (task 5: M13's blue giants and its red ones). */
  accent2?: string;
};
/**
 * Galaxies (colour round task 4). Every value below is the hex the object's
 * own section of .superpowers/sdd/sky-colour/colour-sources.md suggests for a
 * colour that file's citations state in words, converted to "r,g,b" and
 * nothing else. Where a source describes no colour for part of a structure,
 * that slot is ABSENT and the draw function leaves it undrawn.
 *
 * ⚠️ M82 is deliberately not here, and that is not an oversight to fix
 * (ruling R-COLOUR-1, .superpowers/sdd/sky-colour/progress.md). Both of its
 * famous portraits are composites of X-ray and infrared data, which have no
 * visible colour at all, so there is nothing honest to fall back on. It draws
 * its structure in the site's own neutrals instead, and its absence here is
 * also what keeps the colour note off its card (task 7).
 *
 * ⚠️ M104 gets a bulge and a dust lane and NO disk: colour-sources.md looked
 * for a sourced "blue disk" for this specific galaxy and could not find one.
 * Nebulae and clusters are task 5's to add.
 */
export const OBJECT_COLOURS: Record<string, ObjectPalette> = {
  // APOD 2019: "a bright yellow nucleus, dark winding dust lanes, luminous
  // blue spiral arms, and bright red emission nebulas".
  m31: { base: "111,168,255", core: "233,214,160", accent: "255,95,82" },
  // NASA/APOD 2017: "blue star clusters and pinkish star forming regions
  // along the galaxy's loosely wound spiral arms". The core was a yellow-white
  // until 2026-09-16, which no cited page said (C1); NASA's own M33 page
  // describes "a nearly face on spiral galaxy with its bright-white core", so
  // the core is that white instead.
  m33: { base: "91,143,214", core: "244,241,232", accent: "255,111,145" },
  // ESA/Hubble: "bright pink star-forming regions... Bright blue star
  // clusters", around an older yellow core.
  m51: { base: "111,168,255", core: "232,200,138", accent: "255,111,168" },
  // NASA: "spiral arms... made up of young, bluish, hot stars", "central
  // bulge contains much older, redder stars". No source names a knot colour
  // for M81 specifically, so it gets no accent and draws no knots; the pink
  // composite everyone shares is ultraviolet plus visible plus infrared and
  // is not this galaxy's colour.
  m81: { base: "91,143,214", core: "232,217,160" },
  // NASA: "the blue of the jet contrasts with the yellow glow from the
  // combined light of billions of unseen stars and the yellow, point-like
  // globular clusters". Base and core are that one yellow-white starlight;
  // the accent is the jet's synchrotron blue.
  m87: { base: "240,228,192", accent: "74,144,226" },
  // NASA/ESA: "a brilliant, white, bulbous core encircled by thick dust lanes
  // comprising the spiral structure". The lane IS the disk here.
  m104: { base: "245,240,225", accent: "36,28,22" },

  /* ---- Nebulae (colour round task 5) ---------------------------------
   * Six of these objects' famous pictures are narrowband maps, not colour.
   * Ruling R-COLOUR-1 is what lets them be coloured at all: colour may
   * follow an emission line's OWN wavelength, never a palette that moves a
   * line to a channel it does not belong to. The wavelengths come from
   * R-COLOUR-2's source, Lodriguss (AstroPix, "Color in astronomical
   * objects"): hydrogen-alpha is "in the deep red at 656.28 nanometers", and
   * planetary nebulae "are blue-green in color from emission lines of doubly
   * ionized oxygen at 495.9 nanometers and 500.7 nanometers". [N II] = red is
   * NOT sourced and nothing below rests on it.
   */
  // The tattered filaments are hydrogen (NASA: "The orange filaments... consist
  // mostly of hydrogen"), so they take H-alpha's own red. NO core: the
  // interior's blue is synchrotron light in a confirmed false-colour
  // composite, and nothing sources what a plain camera would see there, so
  // the Crab's interior draws in the site's own ink.
  m1: { base: "232,115,74" },
  // NASA: "wisps of pinkish-grey clouds fill the scene... Bright, blue-white
  // stars shine through the cloud", with patches of dark dust over it.
  m8: { base: "244,127,168", accent: "191,227,255" },
  // The gold-on-teal Pillars are the Hubble palette (SHO), with H-alpha put
  // on GREEN: NASA's own page calls the filters "narrowband... creating the
  // enhanced color palette". What is left when that is stripped away is a
  // hydrogen glow, which is red, and dust columns, which are opaque and take
  // no colour at all.
  m16: { base: "224,82,106" },
  // The Trifid is two halves, and ESO's own words for them (added to the card
  // 2026-09-16, C1: nothing cited before then attributed the blue to
  // scattering) are "the round, pink-reddish area typical of an emission
  // nebula" and "the bluish patch to the upper left, called a reflection
  // nebula", where "dust grains and molecules scatter blue light more
  // efficiently than red light".
  m20: { base: "217,69,95", accent: "74,127,209" },
  // A planetary nebula, so the body is O III blue-green by Lodriguss's own
  // sentence. NASA's own rendering puts hydrogen on green, which is the thing
  // the ruling forbids following.
  //
  // ⚠️ NO red fringe, dropped 2026-09-16 (final review M2). It used to ring
  // the outer lobes as "the hydrogen shell", but NASA's stratification for
  // this object runs blue oxygen, GREEN hydrogen, red sulphur and nitrogen, so
  // hydrogen is the MIDDLE shell and the outer red is [N II] and [S II] --
  // which R-COLOUR-2 says is not sourced. A red outer fringe over a blue-green
  // body is the narrowband composite's own arrangement, reached by a different
  // route. The shell reads as O III alone until a source puts H-alpha at the
  // edge.
  m27: { base: "111,214,232" },
  // The one nebula here with a calibrated broadband measurement: ClarkVision
  // finds the Trapezium region "blue-green, and best described as teal", with
  // the wider cloud pink-red from H-alpha. NOT NASA's orange/green/red
  // version of the same object, which is an explicit false-colour map.
  m42: { base: "244,113,138", core: "79,224,200" },
  // The Ring: O III blue-green through the ring, and nothing else. NASA's
  // picture puts helium on blue and nitrogen on red through three narrowband
  // filters; neither of those colours is here.
  //
  // ⚠️ NO red rim either, same fix and same date as M27's above. APOD's
  // reading of this object is explicit that "the cyan color of the inner ring
  // is the glow of hydrogen and oxygen, and the reddish color of the outer
  // ring is from nitrogen and sulfur": hydrogen is INSIDE, so a red outer rim
  // ran the source backwards.
  m57: { base: "111,224,200" },
  // APOD: "The dust not only absorbs light, but also reflects the light of
  // several bright blue stars... The same type of scattering that colors the
  // daytime sky further enhances the blue color."
  m78: { base: "111,143,212", accent: "159,184,232" },
  // APOD: "the nebula's suggestive reddish color is due to the glow of
  // hydrogen atoms", with "a dark lane of absorbing interstellar dust... in
  // silhouette against the hydrogen glow".
  flame: { base: "217,113,74" },
  // The head itself is opaque dust and has no colour; what it blocks is
  // IC 434's H-alpha backdrop, and the accent is the lit edge where Sigma
  // Orionis is eroding it.
  horsehead: { base: "224,82,106", accent: "242,143,163" },
  // NASA: "Sensitive cameras can pick up the reddish color that is
  // characteristic of hydrogen that dominates C20." Confirmed broadband: a
  // plain long exposure really does come out red here. The Gulf of Mexico is
  // the foreground cloud LDN 935 and draws as dust, not as a colour.
  ngc7000: { base: "194,59,74" },
  // ⚠️ THE LOUDEST FALSE-COLOUR TRAP ON THE CHART. The Veil's famous teal and
  // red is ESA/Hubble's narrowband map, in its own caption: "blue shows
  // oxygen, green shows sulphur, and red shows hydrogen". Broadband images of
  // it are far dimmer and red-dominant, so both arcs draw thin hydrogen-red
  // filaments at low alpha and carry NO oxygen teal, even though the ruling
  // would technically allow O III its own colour: the teal is the half of
  // that image everyone recognises, and reproducing it would read as the
  // poster rather than as the object.
  ngc6960: { base: "194,59,74" },
  ngc6992: { base: "194,59,74" },

  /* ---- Clusters (colour round task 5) ---------------------------------
   * No gas here, no narrowband problem: a star's colour is its temperature,
   * which is why these are the most solidly sourced entries in the table.
   */
  // APOD's colour-magnitude reading of M13: "Blue stars are hot and red stars
  // are cool", over a core EarthSky describes as "so dense in the middle it
  // looks solid white". Base is that core white, and the two accents are the
  // blue giants and the red ones.
  m13: { base: "247,241,222", accent: "188,217,255", accent2: "255,180,136" },
  // APOD: "The cluster's few yellowish tinted, cool, red giants are scattered
  // through the field of its brighter hot blue main sequence stars."
  m44: { base: "188,215,255", accent: "240,180,106" },
  // Hot blue-white stars inside blue reflection nebulosity: APOD's reflection
  // -nebula page, on Merope in this cluster, "The blue color typical of
  // reflection nebula is caused by blue light being more efficiently
  // scattered by the carbon dust than red light."
  m45: { base: "205,228,255", accent: "111,168,220" },
  // ⚠️ Stars only, no gas. The pink hydrogen glow around them in the APOD
  // image is narrowband enhancement, by its own caption, so neither half gets
  // an accent and neither draws a haze.
  //
  // ⚠️ And be explicit about what this blue-white IS (final review C1): no
  // source on these cards, and none found on 2026-09-16 (NASA's Caldwell 14
  // page, three more APODs), calls these stars blue or blue-white. What the
  // card does carry is APOD's "stars much younger and hotter than the Sun",
  // so the colour here is STELLAR TEMPERATURE, the same physics M13's and
  // M44's sourced star colours rest on, not a quoted colour. It is the one
  // inference in this table, and it stays only because temperature-to-colour
  // is the single least contested claim on the chart.
  ngc869: { base: "191,212,245" },
  ngc884: { base: "191,212,245" },
};
/**
 * Of the palettes above, the ones that rest on an emission line's own
 * wavelength rather than on a star's temperature (colour round task 7,
 * ruling R-COLOUR-2). Their cards' colour note carries the Lodriguss
 * citation for what a line photographs as; every other coloured card does
 * not need it, because star colour is temperature and each card already
 * sources its own.
 *
 * The line is drawn at the BASE colour: M20's blue lobe and M45's blue haze
 * are dust scattering starlight, and M78 is nothing but that, so M78 is
 * absent here even though it is a nebula. An id absent from OBJECT_COLOURS
 * entirely (M82) gets no note at all, emission or otherwise.
 */
export const EMISSION_LINE_COLOURED: ReadonlySet<string> = new Set([
  "m1", // hydrogen filaments
  "m8", // hydrogen ionized by the embedded cluster
  "m16", // the hydrogen glow left when the SHO palette is stripped off
  "m20", // the red half is Hα/S II; the blue lobe is scattering
  "m27", // O III body, hydrogen rim
  "m42", // H-alpha cloud around an O III teal Trapezium region
  "m57", // O III ring, hydrogen rim
  "flame", // hydrogen glow behind its dust lane
  "horsehead", // the backdrop it blocks is IC 434's hydrogen
  "ngc7000", // hydrogen, confirmed broadband red
  "ngc6960", // supernova remnant, hydrogen filaments only
  "ngc6992",
]);
/** Dark material in silhouette: the Horsehead's own suggested hex (#15100c),
 *  near the desk's #0c0b09. Dust emits nothing, so this is the absence of a
 *  colour claim rather than one: it is painted OVER lit gas, where it reads
 *  as the hole it is, and never on bare sky. Same trick as the galaxies'
 *  dust lanes (STARBURST_MONO.accent). */
const DUST_DARK = "21,16,12";
/** M82's neutrals, and the fallback for any galaxy whose palette names no
 *  dust colour. Near the desk (#0c0b09) so a lane painted over a body reads
 *  as a gap in it rather than as a coloured bar. */
const STARBURST_MONO: ObjectPalette = { base: INK, core: INK, accent: "24,20,16" };
/**
 * One fill alpha per Milky Way level (spec order: 0 faint/outer, 4
 * bright/inner), replacing the old flat 0.022 ("clutter" follow-up,
 * 2026-09-15). Each level's fill composites OVER the ones already drawn, so
 * they still stack toward the core the way flat equal alphas did; growing
 * the per-level step on top of that is what makes the core visibly
 * brighter, not just the whole band a little more opaque everywhere. Tuned
 * by eye (Task 4 Step 9, then this pass) against a real screenshot.
 */
const MILKY_WAY_LEVEL_ALPHA = [0.02, 0.024, 0.03, 0.038, 0.05];
/** Grain alpha, same per-level indexing as above and as `mw.grain`: fainter
 *  outer dots, brighter inner ones, so the stipple itself gets denser and
 *  brighter toward the core, not just the wash underneath it. */
const MILKY_WAY_GRAIN_ALPHA = [0.05, 0.07, 0.1, 0.15, 0.22];
/**
 * Colour ramp for the band's own five levels (li 0 faint/outer to li 4
 * bright/inner), "r,g,b" strings like INK/MUT/WARM so each draw site appends
 * its own alpha. Saturation 0 still paints plain INK at every level (see the
 * draw sites below), so the grey chart is byte-identical to before this ramp
 * existed. (The band itself lerps toward MILKY_WAY_LEVEL_RGB_STARGAZE below.)
 *
 * Source: .superpowers/sdd/colour-sources.md, "Milky Way band" section.
 * That section's photographed description is "yellowish-white galactic
 * core/bulge (overlapping billions of stars), brown/tan dark dust lanes,
 * scattered red emission nebulae, scattered blue reflection nebulae",
 * suggested hex core `#e8dcc0`. The red/blue knots are individual emission
 * and reflection nebulae, i.e. new geometry this task does not add (out of
 * scope: "do not add new geometry", brief step 1); what IS in scope, the
 * band's own overall wash, is that same section's "brightening toward the
 * core" structure. li4 is exactly the sourced core hex `#e8dcc0` (232,220,192);
 * li0 is a duller, cooler tan the other four levels interpolate away from, so
 * the wash warms and brightens toward the centre the way the source
 * describes without inventing a hue the source never names.
 */
const MILKY_WAY_LEVEL_RGB = ["180,168,148", "193,181,159", "206,194,170", "219,207,181", "232,220,192"];
/**
 * ⚠️ Colour alone did nothing, and this is why (measured, colour round
 * 2026-09-16). The band paints at 2 to 5 percent alpha over a desk of
 * (12,11,9). At that opacity the difference between INK's warmth (r−b = 16)
 * and the sourced tan's (r−b = 40) lands as about ONE level out of 255: a
 * 375-pixel sample across the band measured a median warmth change of zero
 * between the two modes. A hue you cannot see is not a colour, it is a
 * comment in the code.
 *
 * So stargaze also lifts the band's opacity, which is the honest move rather
 * than a cheat: a long exposure genuinely is brighter AND more saturated than
 * the eye, the credit line already says these are long-exposure colours, and
 * the same multiplier applies to the grain so the stipple keeps its relation
 * to the wash. Normal mode reads neither of these and stays byte-identical.
 *
 * Tuned against the objects drawn on top: the band is the largest painted
 * area in the scene, so the ceiling here is the point where it starts to
 * drown a nebula, not the point where it stops looking pretty.
 */
const MILKY_WAY_STARGAZE_ALPHA_GAIN = 2.6;
/** Saturated toward the tan a long exposure records. Same hue family as the
 *  sourced core hex, pushed until it survives compositing; li4 keeps the
 *  source's own brightness relationship to the rest. */
const MILKY_WAY_LEVEL_RGB_STARGAZE = ["150,120,84", "168,134,92", "188,152,104", "208,172,120", "226,196,146"];

/** What every layer needs to know about the frame. `suppressName` is the id
 *  (a hit id, or "milky-way") whose always-on name must be skipped because
 *  the hover/selection label is about to draw the same name over it (fix
 *  round 1, C1: the two used to double-draw and fuse with neighbours). */
export type View = {
  chart: Chart;
  width: number;
  height: number;
  fontFamily: string;
  names: boolean;
  /**
   * How much of the sourced colour draws, 0..1 (discoverability spec §3).
   * 0 is the grey chart exactly as it drew before colour existed (the plain
   * glyphs, INK band); anything above 0 takes the coloured draw paths with
   * every palette colour mixed toward its own luminance by `1 - saturation`,
   * and 1 is the full stargaze colour. The ends are pinned byte for byte by
   * scripts/test-sky-objects.mjs.
   */
  saturation: number;
  /** Stargaze's fixed chrome (the hint bar, the credit block) is on screen,
   *  so the band's label keeps clear of it. Was read off `colour` when
   *  colour meant stargaze; the two are separate now. */
  stargazeChrome: boolean;
  /** The stargaze hint bar's measured bottom edge in px (discoverability
   *  Task 5). It wraps to more lines on a narrow screen as it gained counts
   *  and "browse the list", so a fixed band stopped describing it. Absent or
   *  0 (unmeasured) falls back to CHROME_TOP_PX. Only read with stargazeChrome. */
  chromeTopPx?: number;
  /** Stargaze only (discoverability spec §4): every drawn name is a click
   *  target there, so it gets a dotted underline, the page's own "this is
   *  clickable" mark. Paper-mode names are not targets and stay plain. The
   *  underline sits inside the name's hit box, so hit-testing is unchanged. */
  underlineNames: boolean;
  /** Below 880px `names` is false; while stargazing this draws names for
   *  the objects with a sourced palette (OBJECT_COLOURS) anyway, so a phone
   *  has something to read and tap. Those names are hit targets and step
   *  down past each other like any other. Ignored when `names` is true. */
  colouredNames: boolean;
  suppressName: string | null;
};

/** The dotted underline's own styles, built once (the name's colour at lower
 *  alpha: mut names at 0.7 underline at 0.45, warm names at 0.75 at 0.5). */
const UNDERLINE_MUT = `rgba(${MUT},0.45)`;
const UNDERLINE_WARM = `rgba(${WARM},0.5)`;
const UNDERLINE_WARM_DIM = `rgba(${WARM},${0.5 * 0.35})`;
const UNDERLINE_DASH = [1, 2];
/**
 * Appends a dotted underline for a name drawn with fillText at (x, baseline)
 * to the current path, spanning the name's measured text inside its hit box
 * (`nameBox` pads NAME_PAD either side and reaches 0.25em + NAME_PAD below
 * the baseline; the line sits 2-3px under the baseline, inside that).
 * Snapped to a half pixel so a 1px line stays one crisp row. The caller
 * strokes once per colour with `strokeUnderlines`.
 */
export function addUnderline(ctx: CanvasRenderingContext2D, box: Box, baseline: number): void {
  const y = Math.round(baseline + 2) + 0.5;
  ctx.moveTo(box.x + NAME_PAD, y);
  ctx.lineTo(box.x + box.w - NAME_PAD, y);
}
/** Strokes the underline path built with `addUnderline` in one dotted pass. */
export function strokeUnderlines(ctx: CanvasRenderingContext2D, style: string): void {
  ctx.lineWidth = 1;
  ctx.setLineDash(UNDERLINE_DASH);
  ctx.strokeStyle = style;
  ctx.stroke();
  ctx.setLineDash([]);
}
/** Whether an object's name draws this frame (see View.colouredNames). */
const drawsName = (v: View, id: string) => v.names || (v.colouredNames && Object.hasOwn(OBJECT_COLOURS, id));

/**
 * The saturation-dependent colour strings, rebuilt only when saturation
 * changes (the paint loop runs ~20 fps and the value rests for seconds at a
 * time; during a ~300ms ease it changes every frame, and 45 small palettes
 * plus ten band strings is still cheap). Deterministic, so a module-level
 * memo keeps sky-render pure in every sense that matters.
 */
let memoS = Number.NaN;
let memoPalettes = new Map<string, ObjectPalette>();
let memoBandRgb: string[] = [];
let memoBandGain = 1;
function colourMemo(s: number): void {
  if (s === memoS) return;
  memoS = s;
  memoPalettes = new Map();
  for (const [id, pal] of Object.entries(OBJECT_COLOURS)) {
    if (s >= 1) {
      memoPalettes.set(id, pal);
      continue;
    }
    const out: ObjectPalette = { base: saturateRgb(pal.base, s) };
    if (pal.core !== undefined) out.core = saturateRgb(pal.core, s);
    if (pal.accent !== undefined) out.accent = saturateRgb(pal.accent, s);
    if (pal.accent2 !== undefined) out.accent2 = saturateRgb(pal.accent2, s);
    memoPalettes.set(id, out);
  }
  // The band runs on its own curve (lib/sky-colour.ts bandMix): a linear
  // lerp over a 2-5% alpha wash left paper mode's band exactly as warm as
  // the grey chart's.
  const b = bandMix(s);
  memoBandRgb = MILKY_WAY_LEVEL_RGB_STARGAZE.map((rgb) => lerpRgb(INK, rgb, b));
  memoBandGain = lerpNum(1, MILKY_WAY_STARGAZE_ALPHA_GAIN, b);
}
/** The palette an object draws with at this view's saturation, or null for
 *  the plain grey glyph (saturation 0, or no sourced palette: M82). */
function paletteFor(v: View, id: string): ObjectPalette | null {
  if (!(v.saturation > 0)) return null;
  colourMemo(v.saturation);
  return memoPalettes.get(id) ?? null;
}
const onCanvas = (p: { x: number; y: number }, v: View, m: number) =>
  p.x > -m && p.x < v.width + m && p.y > -m && p.y < v.height + m;

/** Padding around a name's text box, so a click on the glyphs' edge still lands. */
const NAME_PAD = 3;
/** How far down to push a name that would land on one already drawn, and how
 *  many times to try before giving up and letting it overlap. One line of 9px
 *  text plus a little air; a handful of tries clears a realistic pile-up
 *  without letting a label drift so far it stops reading as this object's. */
const NAME_STACK_STEP_PX = 11;
const NAME_STACK_TRIES = 4;
/** A phone name closer than this to the right edge flips to the symbol's left. */
const PHONE_NAME_EDGE_PX = 4;
const boxesOverlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** How far the Milky Way's label centre must clear a drawn object's symbol
 *  before that anchor counts as usable. Comfortably past the widest on-symbol
 *  hit radius (a big glyph's `core`, capped at 12) so the band's box, and not
 *  the object, wins a click aimed at the label. */
const LABEL_CLEARANCE_PX = 30;
/** Stargaze's own chrome: the hint line across the top and the credit block
 *  along the bottom. The band's label avoids both, so it is neither hard to
 *  read nor hard to click. Generous on the bottom because the credit wraps to
 *  three lines on a narrow window.
 *
 *  ⚠️ Stargaze ONLY, and the code below gates them on v.stargazeChrome for that
 *  reason (final review m6). On the ordinary page there is no fixed hint bar
 *  and the credit sits at the bottom of the document rather than the
 *  viewport, so applying these there pushed the label out of 220px of
 *  viewport for nothing, and moved it from where main draws it. */
const CHROME_TOP_PX = 90;
const CHROME_BOTTOM_PX = 130;
/** Air between the measured hint bar and a phone name below it. */
const CHROME_TOP_GAP_PX = 6;
/** Where stargaze's top chrome ends for a phone name: the hint bar's measured
 *  bottom plus a little air, or the old fixed band while it is unmeasured. */
const phoneChromeTop = (v: View) => (v.chromeTopPx ? v.chromeTopPx + CHROME_TOP_GAP_PX : CHROME_TOP_PX);
/** The band's label keeps the old, roomier band unless the bar has grown past it. */
const labelChromeTop = (v: View) => Math.max(CHROME_TOP_PX, phoneChromeTop(v));
/**
 * The box a name occupies when drawn with fillText at (x, baseline) in the
 * context's CURRENT font of `px` size: measured width, a cap height of
 * ~0.8em above the baseline and ~0.25em below, padded.
 */
export function nameBox(ctx: CanvasRenderingContext2D, text: string, x: number, baseline: number, px: number): Box {
  const w = ctx.measureText(text).width;
  return { x: x - NAME_PAD, y: baseline - 0.8 * px - NAME_PAD, w: w + 2 * NAME_PAD, h: 1.05 * px + 2 * NAME_PAD };
}

/**
 * The band, plus where its one label goes. `anchor` is the label point
 * whether or not a name is drawn; `hit` exists only when the name is drawn
 * (>=880px), and is selectable by that name's box alone (final review F6:
 * it used to be an invisible 12px point, at the text baseline on desktop
 * and at nothing visible at all on a phone). Below 880px the band has no
 * canvas hit; NightSky lists it in the stargaze keyboard list instead.
 */
export function drawMilkyWay(
  ctx: CanvasRenderingContext2D,
  v: View,
  mw: PreparedMilkyWay,
  /** Already-projected object points the label should not sit on; see the
   *  anchor-picking comment below. Empty is fine and keeps the old behaviour. */
  avoid: readonly { x: number; y: number }[] = [],
): { hit: Hit | null; anchor: { x: number; y: number } | null } {
  const c = v.chart;
  const lst = c.lstDeg * D2R;
  const toScreen = (raRad: number, tanHalfColat: number) => {
    const rho = c.k * tanHalfColat;
    const phi = raRad - lst;
    return { x: c.cx + rho * Math.sin(phi), y: c.cy - rho * Math.cos(phi) };
  };
  // Hue lerps INK -> the stargaze tan and the alpha gain 1 -> 2.6, both by
  // bandMix(saturation): 0 is plain INK at gain 1, 1 is the stargaze band.
  colourMemo(v.saturation);
  const bandRgb = (li: number) => memoBandRgb[li] ?? memoBandRgb[memoBandRgb.length - 1];
  const bandGain = memoBandGain;
  mw.levels.forEach((rings, li) => {
    ctx.fillStyle = `rgba(${bandRgb(li)},${(MILKY_WAY_LEVEL_ALPHA[li] ?? 0.03) * bandGain})`;
    ctx.beginPath();
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 2) {
        const { x, y } = toScreen(ring[i], ring[i + 1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    // Rings nest (the band's two edges, dark lanes, bright clouds): even-odd
    // fills exactly the area between them.
    ctx.fill("evenodd");
  });
  // A grain of tiny points over the fill so the band reads as a haze of
  // stars, not a flat wash; brighter and denser toward the core (mw.grain is
  // aligned to mw.levels, prepared once in lib/sky-objects.ts). Cheap: a
  // fillStyle change per level (5 total, not per point) and a fillRect each.
  mw.grain.forEach((pts, li) => {
    // The grain takes the same gain as the wash, so the stipple keeps its
    // relation to what it sits on instead of flattening into it.
    ctx.fillStyle = `rgba(${bandRgb(li)},${Math.min(0.5, (MILKY_WAY_GRAIN_ALPHA[li] ?? 0.08) * bandGain)})`;
    for (let i = 0; i < pts.length; i += 2) {
      const { x, y } = toScreen(pts[i], pts[i + 1]);
      ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
    }
  });
  // One "Milky Way" label: the on-canvas anchor closest to the pole, which is
  // the most stable choice as the sky turns.
  //
  // ⚠️ Anchors that a drawn object sits on are passed over first (colour
  // round, 2026-09-15). The band is selectable by its label box ALONE
  // (`boxOnly`), and hit precedence runs the on-symbol pass before any box,
  // so an object within a few px of the label makes the Milky Way
  // unclickable there. That is not hypothetical: adding the Double Cluster
  // put NGC 869 and NGC 884 6 and 10px from the label's own centre, which is
  // no accident — the Double Cluster lies IN the band, and the band's
  // anchors are in the band by construction, so this collision class recurs
  // every time a new object lands in the Milky Way.
  //
  // Two things spoil an anchor: a drawn object sitting on it, and, while
  // stargazing, the page's own chrome. Stargaze puts a hint line across the
  // top and a credit block along the bottom, so a label parked there is both
  // hard to read and hard to click; the ordinary page has neither fixed to
  // the viewport, so it scores objects alone. Both are scored, clear beats
  // crowded, and closeness to the pole only breaks ties within a tier. If EVERY anchor is spoiled we still take
  // the closest rather than drop the label: a band a visitor has to hunt to
  // click still beats an unlabelled one.
  ctx.font = `9px ${v.fontFamily}`;
  const labelHalfW = ctx.measureText("Milky Way").width / 2;
  const spoiled = (p: { x: number; y: number }) => {
    if (v.stargazeChrome && (p.y < labelChromeTop(v) || p.y > v.height - CHROME_BOTTOM_PX)) return true;
    return avoid.some((o) => Math.hypot(o.x - (p.x + labelHalfW), o.y - p.y) < LABEL_CLEARANCE_PX);
  };
  let best: { x: number; y: number } | null = null;
  let bestRho = Infinity;
  let bestSpoiled = true;
  for (const [ra, dec] of mw.labels) {
    const p = project(c, ra, dec);
    if (!onCanvas(p, v, -40)) continue;
    const rho = Math.hypot(p.x - c.cx, p.y - c.cy);
    const isSpoiled = spoiled(p);
    if (bestSpoiled && !isSpoiled) {
      best = p;
      bestRho = rho;
      bestSpoiled = false;
    } else if (isSpoiled === bestSpoiled && rho < bestRho) {
      best = p;
      bestRho = rho;
    }
  }
  if (!best) return { hit: null, anchor: null };
  // Gated on v.names like every other always-on label (M5, fix round 1).
  // Also skipped when the band itself is the current hover/selection, whose
  // own label is about to draw the same name in the same place (C1).
  if (!v.names) return { hit: null, anchor: best };
  ctx.font = `9px ${v.fontFamily}`;
  if (v.suppressName !== "milky-way") {
    ctx.fillStyle = `rgba(${MUT},0.5)`;
    ctx.fillText("Milky Way", best.x, best.y);
  }
  const box = nameBox(ctx, "Milky Way", best.x, best.y, 9);
  if (v.underlineNames && v.suppressName !== "milky-way") {
    ctx.beginPath();
    addUnderline(ctx, box, best.y);
    strokeUnderlines(ctx, UNDERLINE_MUT);
  }
  return { hit: { id: "milky-way", name: "Milky Way", x: best.x, y: best.y, box, boxOnly: true }, anchor: best };
}

/**
 * A unit (radius 0..1), two-armed logarithmic-ish spiral, sampled once at
 * module load ("clutter" follow-up, 2026-09-15): every galaxy glyph shares
 * these points and reaches its own size/tilt through ctx.translate/rotate/
 * scale at draw time, so drawing a galaxy costs a handful of canvas calls,
 * never a re-derivation of the spiral itself.
 */
const SPIRAL_ARM_STEPS = 20;
function buildSpiralArm(mirror: boolean): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= SPIRAL_ARM_STEPS; i++) {
    const t = i / SPIRAL_ARM_STEPS;
    const r = SPIRAL_R0 + SPIRAL_DR * t;
    const theta = t * SPIRAL_TURNS * Math.PI * 2 * (mirror ? -1 : 1);
    pts.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
  }
  return pts;
}
const SPIRAL_ARMS = [buildSpiralArm(false), buildSpiralArm(true)];

/** A tilted spiral: bright core, a couple of faint arms, an elongated halo
 *  (not to scale; see the credit line and the object's card). The core is
 *  drawn last, outside the rotate/scale, so it stays round instead of
 *  squashed onto the galaxy's minor axis.
 *
 *  This is what every galaxy draws with no palette: at saturation 0, and
 *  M82 at every saturation. */
function drawPlainGalaxy(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: GalaxyGlyph): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(g.tiltDeg * D2R);
  ctx.scale(g.majorPx, g.minorPx);
  ctx.beginPath();
  ctx.ellipse(0, 0, 1, 1, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${INK},0.09)`;
  ctx.fill();
  ctx.lineWidth = 0.12;
  ctx.strokeStyle = `rgba(${MUT},0.4)`;
  for (const arm of SPIRAL_ARMS) {
    ctx.beginPath();
    arm.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${INK},0.85)`;
  ctx.fill();
}

/* --- the coloured variants (any saturation above 0) ------------------- *
 *
 * Alpha discipline: this is a dim chart on a near-black desk, not a poster.
 * Every fill below is low-alpha and STACKS, which is how a body gets brighter
 * toward its middle without a single createRadialGradient. That matters for
 * more than taste: a gradient's coordinates are the object's screen position,
 * which moves every frame, so a gradient here would have to be rebuilt ~20
 * times a second per object. Three nested fills cost less than one
 * createRadialGradient, and they cost the same on every frame.
 */

/** Nested body fills, faint outside, stacking toward the middle. Scales are
 *  fractions of the glyph's own major/minor radii, drawn under the glyph's
 *  rotation (the caller owns the transform). */
const BODY_SCALES = [1, 0.72, 0.46];
const BODY_ALPHA = 0.05;
/** A round bulge, always drawn OUTSIDE the rotate/scale so it stays round.
 *  The innermost layer is the plain glyph's own core (r 1.6, alpha 0.85); the
 *  two around it are what make it read as a glow rather than a dot. */
const BULGE_LAYERS: [number, number][] = [
  [3.4, 0.09],
  [2.3, 0.18],
  [1.6, 0.85],
];
function drawBulge(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, rgb: string, scale = 1): void {
  for (const [r, a] of BULGE_LAYERS) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * scale, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb},${a})`;
    ctx.fill();
  }
}
function fillBody(ctx: CanvasRenderingContext2D, g: GalaxyGlyph, rgb: string, scales: number[], alpha: number): void {
  ctx.fillStyle = `rgba(${rgb},${alpha})`;
  for (const s of scales) {
    ctx.beginPath();
    ctx.ellipse(0, 0, g.majorPx * s, g.minorPx * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
function fillPlaced(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, places: readonly { dx: number; dy: number; r: number }[], rgb: string, alpha: number): void {
  ctx.fillStyle = `rgba(${rgb},${alpha})`;
  for (const k of places) {
    ctx.beginPath();
    ctx.arc(p.x + k.dx, p.y + k.dy, k.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
/** The dust lane, in the glyph's rotated frame (the caller owns the
 *  transform). Painted at high alpha in a near-desk dark so it subtracts the
 *  body's light instead of adding a coloured bar: the lane reads as the gap
 *  it is. */
function fillLane(ctx: CanvasRenderingContext2D, lane: NonNullable<GalaxyGlyph["lane"]>, rgb: string): void {
  ctx.fillStyle = `rgba(${rgb},0.85)`;
  ctx.fillRect(-lane.spanPx / 2, lane.offsetPx - lane.halfPx, lane.spanPx, lane.halfPx * 2);
}

/** M31, M33, M81, and M51 with its companion: blue arms over a blue disk,
 *  a warm core, and (where a source names them) red or pink H II knots on
 *  the arms. */
function drawSpiralGalaxy(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: GalaxyGlyph, pal: ObjectPalette | null): void {
  if (!pal) return drawPlainGalaxy(ctx, p, g);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(g.tiltDeg * D2R);
  fillBody(ctx, g, pal.base, BODY_SCALES, BODY_ALPHA);
  ctx.scale(g.majorPx, g.minorPx);
  ctx.lineWidth = 0.11;
  ctx.strokeStyle = `rgba(${pal.base},0.45)`;
  for (const arm of SPIRAL_ARMS) {
    ctx.beginPath();
    arm.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.stroke();
  }
  ctx.restore();
  // The companion carries no colour of its own: no source in colour-sources.md
  // describes NGC 5195's, so it draws in the site's ink like any uncoloured
  // thing on the chart.
  if (g.companion) fillPlaced(ctx, p, [g.companion, { ...g.companion, r: g.companion.r * 0.45 }], INK, 0.17);
  if (pal.accent) fillPlaced(ctx, p, g.knots, pal.accent, 0.5);
  drawBulge(ctx, p, pal.core ?? pal.base);
}

/** M87: a smooth halo of old starlight, its yellow globular clusters, and the
 *  synchrotron jet, which is the one thing on this chart that has to be
 *  visible at a glance. */
function drawEllipticalGalaxy(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: GalaxyGlyph, pal: ObjectPalette | null): void {
  if (!pal) return drawPlainGalaxy(ctx, p, g);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(g.tiltDeg * D2R);
  fillBody(ctx, g, pal.base, [1, 0.78, 0.56, 0.34], 0.05);
  ctx.restore();
  fillPlaced(ctx, p, g.knots, pal.core ?? pal.base, 0.4);
  if (g.jet && pal.accent) {
    const a = g.jet.angleDeg * D2R;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const s0 = 2.4;
    const s1 = g.jet.lengthPx;
    const w0 = 0.5;
    const w1 = g.jet.halfWidthPx;
    ctx.beginPath();
    ctx.moveTo(p.x + ux * s0 - uy * w0, p.y + uy * s0 + ux * w0);
    ctx.lineTo(p.x + ux * s1 - uy * w1, p.y + uy * s1 + ux * w1);
    ctx.lineTo(p.x + ux * s1 + uy * w1, p.y + uy * s1 - ux * w1);
    ctx.lineTo(p.x + ux * s0 + uy * w0, p.y + uy * s0 - ux * w0);
    ctx.closePath();
    ctx.fillStyle = `rgba(${pal.accent},0.5)`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x + ux * s1, p.y + uy * s1, w1 * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${pal.accent},0.75)`;
    ctx.fill();
  }
  drawBulge(ctx, p, pal.core ?? pal.base);
}

/** M104: a brilliant bulge with the dust ring crossing it, and nothing else.
 *  No disk is drawn on purpose, because no fetched source describes the
 *  Sombrero's disk colour (colour-sources.md's own gap note). The lane runs
 *  wider than the bulge, so the ring shows past it on both sides. */
function drawEdgeOnGalaxy(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: GalaxyGlyph, pal: ObjectPalette | null): void {
  if (!pal) return drawPlainGalaxy(ctx, p, g);
  const bulgeR = Math.max(g.minorPx * 1.25, 4);
  ctx.fillStyle = `rgba(${pal.base},0.055)`;
  for (const s of BODY_SCALES) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, bulgeR * s, 0, Math.PI * 2);
    ctx.fill();
  }
  drawBulge(ctx, p, pal.core ?? pal.base);
  if (g.lane) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(g.tiltDeg * D2R);
    fillLane(ctx, g.lane, pal.accent ?? STARBURST_MONO.accent!);
    ctx.restore();
  }
}

/** M82: an edge-on disk split by its dust lane, with the superwind's
 *  filaments running out both faces. Shape only. It takes STARBURST_MONO
 *  rather than a palette because nothing honest is available to colour it
 *  with (see OBJECT_COLOURS' note), and it draws the same in stargaze as out
 *  of it. */
function drawStarburstGalaxy(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: GalaxyGlyph, pal: ObjectPalette | null): void {
  const c = pal ?? STARBURST_MONO;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(g.tiltDeg * D2R);
  fillBody(ctx, g, c.base, BODY_SCALES, 0.06);
  if (g.lane) fillLane(ctx, g.lane, c.accent ?? STARBURST_MONO.accent!);
  ctx.restore();
  if (g.plumes.length) {
    ctx.beginPath();
    for (const f of g.plumes) {
      ctx.moveTo(p.x + f.x1, p.y + f.y1);
      ctx.lineTo(p.x + f.x2, p.y + f.y2);
    }
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = `rgba(${MUT},0.3)`;
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  drawBulge(ctx, p, c.core ?? c.base);
}

/**
 * One draw path per variant, each of them picking its colours out of the
 * palette it is handed; `null` (colour off, or an id with no palette entry)
 * falls back to the plain grey glyph above. The one exception is the
 * starburst, which HAS no honest palette and so would otherwise never draw
 * the structure it was given.
 */
function drawGalaxyGlyph(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: GalaxyGlyph, pal: ObjectPalette | null): void {
  switch (g.variant) {
    case "elliptical":
      return drawEllipticalGalaxy(ctx, p, g, pal);
    case "edge-on":
      return drawEdgeOnGalaxy(ctx, p, g, pal);
    case "starburst":
      return drawStarburstGalaxy(ctx, p, g, pal);
    default:
      return drawSpiralGalaxy(ctx, p, g, pal);
  }
}

/** Dust in silhouette: round-capped thick segments, painted over lit gas so
 *  they subtract its light instead of adding a shape to bare sky. */
function strokeDust(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, lanes: readonly DustLane[]): void {
  if (!lanes.length) return;
  ctx.strokeStyle = `rgba(${DUST_DARK},0.9)`;
  ctx.lineCap = "round";
  for (const d of lanes) {
    ctx.lineWidth = d.w;
    ctx.beginPath();
    ctx.moveTo(p.x + d.x1, p.y + d.y1);
    ctx.lineTo(p.x + d.x2, p.y + d.y2);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.lineWidth = 1;
}
/** A blob's colour from its prepared tint: base, accent, core. A missing slot
 *  falls back to the base, so a palette that names fewer colours than a
 *  variant could use simply draws fewer. */
const tintOf = (pal: ObjectPalette, t: 0 | 1 | 2) => (t === 1 ? (pal.accent ?? pal.base) : t === 2 ? (pal.core ?? pal.base) : pal.base);
function fillTinted(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, places: readonly TintedPlaced[], pal: ObjectPalette, alpha: number, slot2 = "core" as "core" | "accent2"): void {
  for (const b of places) {
    ctx.fillStyle = `rgba(${b.tint === 2 && slot2 === "accent2" ? (pal.accent2 ?? pal.base) : tintOf(pal, b.tint)},${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x + b.dx, p.y + b.dy, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
/** An H II region: a glowing cloud with dark dust over it, and, where a
 *  source names them, the young stars doing the ionizing. */
function drawEmissionNebula(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: NebulaGlyph, pal: ObjectPalette): void {
  fillTinted(ctx, p, g.blobs, pal, 0.17);
  if (g.coreBlob && pal.core) fillPlaced(ctx, p, [g.coreBlob], pal.core, 0.22);
  strokeDust(ctx, p, g.dust);
  if (pal.accent && g.stars.length) fillPlaced(ctx, p, g.stars, pal.accent, 0.8);
}
/**
 * A shell thrown off a dying star, in the blue-green of doubly ionized
 * oxygen, which is the whole of it.
 *
 * Both of these objects fringed their outer edge in H-alpha red until
 * 2026-09-16; see M27's and M57's entries in OBJECT_COLOURS for why that came
 * off. The `accent` slot is not read here any more, on purpose: an unread
 * branch waiting for a colour nobody has sourced is how the wrong red would
 * come back, so the code that drew it is gone rather than dormant.
 */
function drawPlanetaryNebula(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: NebulaGlyph, pal: ObjectPalette): void {
  if (g.ring) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, g.ring.outerR, 0, Math.PI * 2);
    ctx.arc(p.x, p.y, g.ring.innerR, 0, Math.PI * 2, true);
    // The grey ring is INK at 0.4; a saturated blue-green at that alpha made
    // M57 the brightest thing on a 1440px chart (screenshot-caught), so the
    // coloured one sits lower.
    ctx.fillStyle = `rgba(${pal.base},0.33)`;
    ctx.fill("evenodd");
    ctx.beginPath();
    ctx.arc(p.x, p.y, g.ring.innerR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${pal.base},0.07)`;
    ctx.fill();
    return;
  }
  fillTinted(ctx, p, g.blobs, pal, 0.2);
}
/** A supernova remnant: filaments, which is nearly all these objects are.
 *  The Crab keeps a diffuse interior under them, and it draws in the site's
 *  own ink, not in a colour: its blue is synchrotron light in a false-colour
 *  composite and nothing sources what a camera would record there. */
function drawRemnantNebula(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: NebulaGlyph, pal: ObjectPalette): void {
  if (g.blobs.length) fillPlaced(ctx, p, g.blobs, INK, 0.1);
  if (!g.filaments.length) return;
  ctx.strokeStyle = `rgba(${pal.base},${g.blobs.length ? 0.5 : 0.34})`;
  ctx.lineWidth = g.blobs.length ? 1 : 0.9;
  ctx.beginPath();
  for (const f of g.filaments) {
    ctx.moveTo(p.x + f.x1, p.y + f.y1);
    ctx.quadraticCurveTo(p.x + f.cx, p.y + f.cy, p.x + f.x2, p.y + f.y2);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
}
/** Dust scattering the light of the stars inside it, the same physics that
 *  makes the daytime sky blue. */
function drawReflectionNebula(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: NebulaGlyph, pal: ObjectPalette): void {
  fillTinted(ctx, p, g.blobs, pal, 0.16);
  strokeDust(ctx, p, g.dust);
  if (pal.accent) fillPlaced(ctx, p, g.stars, pal.accent, 0.85);
}
/** The Horsehead. A dark nebula emits nothing, so the glyph is really the
 *  backdrop it blocks: IC 434's hydrogen glow goes down first, the opaque
 *  head over it, and a lit rim along the edge the radiation is eroding.
 *  Without the backdrop this is a dark smudge on a dark sky. */
function drawDarkNebula(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: NebulaGlyph, pal: ObjectPalette): void {
  fillTinted(ctx, p, g.blobs, pal, 0.15);
  if (!g.silhouette.length) return;
  ctx.beginPath();
  g.silhouette.forEach((s, i) => (i === 0 ? ctx.moveTo(p.x + s.dx, p.y + s.dy) : ctx.lineTo(p.x + s.dx, p.y + s.dy)));
  ctx.closePath();
  ctx.fillStyle = `rgba(${DUST_DARK},0.95)`;
  ctx.fill();
  if (pal.accent) {
    ctx.strokeStyle = `rgba(${pal.accent},0.45)`;
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}
/**
 * One draw path per variant, each picking its colours out of the palette it
 * is handed; `null` (colour off, or an id with no palette entry) falls back
 * to the plain grey glyph, which is unchanged from before the colour round.
 */
function drawNebulaGlyph(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: NebulaGlyph, pal: ObjectPalette | null): void {
  if (!pal) return drawPlainNebula(ctx, p, g);
  switch (g.variant) {
    case "planetary":
      return drawPlanetaryNebula(ctx, p, g, pal);
    case "remnant":
      return drawRemnantNebula(ctx, p, g, pal);
    case "reflection":
      return drawReflectionNebula(ctx, p, g, pal);
    case "dark":
      return drawDarkNebula(ctx, p, g, pal);
    default:
      return drawEmissionNebula(ctx, p, g, pal);
  }
}

/**
 * A few overlapping low-alpha blobs read as a soft, irregular cloud instead
 * of a dotted circle; M57 (Ring Nebula) gets a plain annulus instead, since
 * that is the shape its own card describes. Overlap brightening is ordinary
 * alpha compositing, no extra blend mode.
 *
 * ⚠️ A dark nebula draws its cloud AND its silhouette over it, and this
 * function used to return after the blobs, which made the silhouette branch
 * unreachable for the only variant that fills one (final review M3): outside
 * stargaze the Horsehead, an object defined by blocking light, rendered as an
 * 11px grey glow. The silhouette now goes down over the backdrop in both
 * modes, so the grey chart says the same thing about it that the coloured one
 * does.
 *
 * The filament branch is the Veil's, the one shape here with no cloud at all.
 * It stays gated on there being no blobs, which is what keeps the Crab's
 * grey glyph byte-identical to its pre-colour-round self: its filaments are
 * new this round and belong to the coloured path.
 */
function drawPlainNebula(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: NebulaGlyph): void {
  if (g.ring) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, g.ring.outerR, 0, Math.PI * 2);
    ctx.arc(p.x, p.y, g.ring.innerR, 0, Math.PI * 2, true);
    ctx.fillStyle = `rgba(${INK},0.4)`;
    ctx.fill("evenodd");
    ctx.beginPath();
    ctx.arc(p.x, p.y, g.ring.innerR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${INK},0.08)`;
    ctx.fill();
    return;
  }
  if (g.blobs.length) {
    ctx.fillStyle = `rgba(${INK},0.16)`;
    for (const b of g.blobs) {
      ctx.beginPath();
      ctx.arc(p.x + b.dx, p.y + b.dy, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (g.silhouette.length) {
    ctx.beginPath();
    g.silhouette.forEach((s, i) => (i === 0 ? ctx.moveTo(p.x + s.dx, p.y + s.dy) : ctx.lineTo(p.x + s.dx, p.y + s.dy)));
    ctx.closePath();
    // The dust itself, painted over the glow it hides: the same near-desk dark
    // the coloured path uses, then the edge picked out in ink so the shape
    // still reads where there is no backdrop behind it.
    ctx.fillStyle = `rgba(${DUST_DARK},0.95)`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${INK},0.5)`;
    ctx.stroke();
    return;
  }
  if (!g.blobs.length && g.filaments.length) {
    ctx.strokeStyle = `rgba(${INK},0.32)`;
    ctx.beginPath();
    for (const f of g.filaments) {
      ctx.moveTo(p.x + f.x1, p.y + f.y1);
      ctx.quadraticCurveTo(p.x + f.cx, p.y + f.cy, p.x + f.x2, p.y + f.y2);
    }
    ctx.stroke();
  }
}

/** The plain grey cluster: the star scatter, unchanged from before the colour
 *  round. The haze is coloured-path only. */
function drawPlainCluster(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: ClusterGlyph): void {
  ctx.fillStyle = `rgba(${INK},0.65)`;
  for (const s of g.stars) {
    ctx.beginPath();
    ctx.arc(p.x + s.dx, p.y + s.dy, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
/**
 * A cluster is stars, and a star's colour is its temperature, so these are
 * the least contested colours on the chart. The globular gets its unresolved
 * core under the yellow-white swarm; an open cluster gets its blue-white
 * stars, and the Pleiades the dust it is drifting through (that haze takes
 * the accent, which is why the Double Cluster, whose only sourced colour is
 * its stars, prepares no haze at all).
 */
function drawClusterGlyph(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, g: ClusterGlyph, pal: ObjectPalette | null): void {
  if (!pal) return drawPlainCluster(ctx, p, g);
  if (g.haze.length) {
    const haze = g.variant === "globular" ? pal.base : (pal.accent ?? pal.base);
    fillPlaced(ctx, p, g.haze, haze, g.variant === "globular" ? 0.08 : 0.07);
  }
  fillTinted(ctx, p, g.stars, pal, 0.7, "accent2");
}

/**
 * Deep-sky symbols, landmarks, Voyagers and the named stars' names. `rings`
 * holds precomputed small-circle outlines by object id (the Kepler field);
 * `glyphs` holds the enlarged galaxy/nebula/cluster shapes ("clutter"
 * follow-up, 2026-09-15), precomputed once per catalog load in
 * lib/sky-objects.ts. `names` false (below 880px) draws symbols only.
 */
export function drawObjects(
  ctx: CanvasRenderingContext2D,
  v: View,
  objects: SkyObject[],
  rings: ReadonlyMap<string, [number, number][]>,
  glyphs: ReadonlyMap<string, ObjectGlyph>,
): Hit[] {
  const c = v.chart;
  const hits: Hit[] = [];
  /** Name boxes already placed this frame, so a later name can step down past
   *  them instead of printing on top (see the nudge loop below). */
  const drawnNameBoxes: Box[] = [];
  /** Underlines to stroke after the loop, one path per name colour. */
  const underlines: { box: Box; baseline: number; warm: boolean }[] = [];
  ctx.lineWidth = 1;
  ctx.font = `9px ${v.fontFamily}`;
  for (const o of objects) {
    const p = project(c, o.raDeg, o.decDeg);
    if (!onCanvas(p, v, 0)) continue;
    const glyph = glyphs.get(o.id);
    const hit: Hit = { id: o.id, name: o.name, x: p.x, y: p.y, core: glyph?.corePx };
    hits.push(hit);
    const human = o.symbol === "chevron";
    switch (o.symbol) {
      case "galaxy": {
        if (glyph && glyph.kind === "galaxy") {
          drawGalaxyGlyph(ctx, p, glyph, paletteFor(v, o.id));
          break;
        }
        // Fallback for a galaxy the size table doesn't (yet) know about.
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 5, 5 * (o.axisRatio ?? 1), -35 * D2R, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.stroke();
        break;
      }
      case "nebula": {
        if (glyph && glyph.kind === "nebula") {
          drawNebulaGlyph(ctx, p, glyph, paletteFor(v, o.id));
          break;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.setLineDash([1.5, 2]);
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case "cluster": {
        if (glyph && glyph.kind === "cluster") {
          drawClusterGlyph(ctx, p, glyph, paletteFor(v, o.id));
          break;
        }
        ctx.fillStyle = `rgba(${INK},0.65)`;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(p.x + 4.5 * Math.cos(a), p.y + 4.5 * Math.sin(a), 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "core": {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${INK},0.9)`;
        ctx.fill();
        break;
      }
      case "field": {
        const ring = rings.get(o.id);
        if (ring) {
          ctx.beginPath();
          ring.forEach(([ra, dec], i) => {
            const q = project(c, ra, dec);
            if (i === 0) ctx.moveTo(q.x, q.y);
            else ctx.lineTo(q.x, q.y);
          });
          ctx.closePath();
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = `rgba(${MUT},0.45)`;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }
      case "square": {
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.strokeRect(p.x - 2, p.y - 2, 4, 4);
        break;
      }
      case "chevron": {
        ctx.beginPath();
        ctx.moveTo(p.x - 3.5, p.y + 2);
        ctx.lineTo(p.x, p.y - 2.5);
        ctx.lineTo(p.x + 3.5, p.y + 2);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = `rgba(${WARM},0.9)`;
        ctx.stroke();
        ctx.lineWidth = 1;
        break;
      }
      case "star":
        break; // the star layer already drew it; this adds the name and the hit
    }
    // Skipped when this object is the current hover/selection (C1): its
    // name is about to be drawn again, larger, by the hover label.
    if (!v.names && drawsName(v, o.id)) {
      // A phone's coloured names (View.colouredNames). A 400px screen has no
      // room to let names collide, clip or sit under stargaze's own controls,
      // so this path is stricter than the desktop one below: a name that
      // would run off the right edge goes on the symbol's left instead, one
      // that finds no clear slot within NAME_STACK_TRIES is left undrawn
      // rather than printed over another, and one whose box would reach the
      // hint bar or the credit block is left undrawn too. Its symbol stays
      // tappable either way; only a drawn name gets a box.
      const dx = o.symbol === "field" ? 0 : glyph ? Math.max(8, glyph.corePx + 8) : 8;
      const textW = ctx.measureText(o.name).width;
      const x = p.x + dx + textW > v.width - PHONE_NAME_EDGE_PX ? p.x - dx - textW : p.x + dx;
      const top = v.stargazeChrome ? phoneChromeTop(v) : 0;
      const bottom = v.height - (v.stargazeChrome ? CHROME_BOTTOM_PX : 0);
      let baseline = p.y + 3;
      let placed: Box | null = null;
      for (let attempt = 0; attempt < NAME_STACK_TRIES; attempt++) {
        const b = nameBox(ctx, o.name, x, baseline, 9);
        if (!drawnNameBoxes.some((q) => boxesOverlap(b, q))) {
          placed = b;
          break;
        }
        baseline += NAME_STACK_STEP_PX;
      }
      if (placed && placed.x >= 0 && placed.y >= top && placed.y + placed.h <= bottom) {
        hit.box = placed;
        drawnNameBoxes.push(placed);
        if (o.id !== v.suppressName) {
          ctx.fillStyle = human ? `rgba(${WARM},0.75)` : `rgba(${MUT},0.7)`;
          ctx.fillText(o.name, x, baseline);
          if (v.underlineNames) underlines.push({ box: placed, baseline, warm: human });
        }
      }
    } else if (v.names) {
      // A bigger glyph pushes its name out past its own edge (the enlarged
      // galaxies/nebulae/clusters, "clutter" follow-up); everything else
      // keeps the original fixed 8px.
      const dx = o.symbol === "field" ? 0 : glyph ? Math.max(8, glyph.corePx + 8) : 8;
      // Nudge a name down until it clears the ones already drawn this frame.
      // Two objects a fraction of a degree apart otherwise print their labels
      // on top of each other into an unreadable smear: the Double Cluster's
      // two halves did exactly that once the catalog gained them (colour
      // round, 2026-09-15), and the same goes for M81 and M82, four px apart.
      // Each name also carries its own hit box, so overlapping boxes make the
      // upper name unclickable as well as unreadable.
      let baseline = p.y + 3;
      for (let attempt = 0; attempt < NAME_STACK_TRIES; attempt++) {
        const b = nameBox(ctx, o.name, p.x + dx, baseline, 9);
        if (!drawnNameBoxes.some((q) => boxesOverlap(b, q))) break;
        baseline += NAME_STACK_STEP_PX;
      }
      hit.box = nameBox(ctx, o.name, p.x + dx, baseline, 9);
      drawnNameBoxes.push(hit.box);
      if (o.id !== v.suppressName) {
        ctx.fillStyle = human ? `rgba(${WARM},0.75)` : `rgba(${MUT},0.7)`;
        ctx.fillText(o.name, p.x + dx, baseline);
        if (v.underlineNames) underlines.push({ box: hit.box, baseline, warm: human });
      }
    }
  }
  if (underlines.length) {
    for (const warm of [false, true]) {
      ctx.beginPath();
      let any = false;
      for (const u of underlines) {
        if (u.warm !== warm) continue;
        addUnderline(ctx, u.box, u.baseline);
        any = true;
      }
      if (any) strokeUnderlines(ctx, warm ? UNDERLINE_WARM : UNDERLINE_MUT);
    }
  }
  return hits;
}

/** A 6-ray burst at each active shower's peak radiant (drift ignored; the card says so). */
export function drawRadiants(ctx: CanvasRenderingContext2D, v: View, active: SkyShower[]): Hit[] {
  const c = v.chart;
  const hits: Hit[] = [];
  ctx.lineWidth = 1;
  ctx.font = `9px ${v.fontFamily}`;
  for (const sh of active) {
    const p = project(c, sh.radiantRaDeg, sh.radiantDecDeg);
    if (!onCanvas(p, v, 0)) continue;
    const hit: Hit = { id: sh.id, name: sh.name, x: p.x, y: p.y };
    hits.push(hit);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.moveTo(p.x + 2 * Math.cos(a), p.y + 2 * Math.sin(a));
      ctx.lineTo(p.x + 6.5 * Math.cos(a), p.y + 6.5 * Math.sin(a));
    }
    ctx.strokeStyle = `rgba(${WARM},0.9)`;
    ctx.stroke();
    if (v.names) {
      hit.box = nameBox(ctx, sh.name, p.x + 9, p.y + 3, 9);
      if (sh.id !== v.suppressName) {
        ctx.fillStyle = `rgba(${WARM},0.75)`;
        ctx.fillText(sh.name, p.x + 9, p.y + 3);
        if (v.underlineNames) {
          ctx.beginPath();
          addUnderline(ctx, hit.box, p.y + 3);
          strokeUnderlines(ctx, UNDERLINE_WARM);
        }
      }
    }
  }
  return hits;
}

/** The ISS: a small warm square with a faint halo, dimmed while it is below Moffett Field's horizon. */
export function drawIss(ctx: CanvasRenderingContext2D, v: View, iss: { eq: Equatorial; aboveHorizon: boolean }): Hit | null {
  const p = project(v.chart, iss.eq.raDeg, iss.eq.decDeg);
  if (!onCanvas(p, v, 0)) return null;
  const a = iss.aboveHorizon ? 1 : 0.35;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${WARM},${0.16 * a})`;
  ctx.fill();
  ctx.fillStyle = `rgba(${WARM},${0.95 * a})`;
  ctx.fillRect(p.x - 1.75, p.y - 1.75, 3.5, 3.5);
  // Skipped when the ISS is the current hover/selection (fix round 1, C1
  // precedent): its name is about to be drawn again, larger, by the hover label.
  const hit: Hit = { id: "iss", name: "ISS", x: p.x, y: p.y };
  if (v.names) {
    ctx.font = `9px ${v.fontFamily}`;
    hit.box = nameBox(ctx, "ISS", p.x + 8, p.y + 3, 9);
    if (v.suppressName !== "iss") {
      ctx.fillStyle = `rgba(${WARM},${0.75 * a})`;
      ctx.fillText("ISS", p.x + 8, p.y + 3);
      if (v.underlineNames) {
        ctx.beginPath();
        addUnderline(ctx, hit.box, p.y + 3);
        strokeUnderlines(ctx, iss.aboveHorizon ? UNDERLINE_WARM : UNDERLINE_WARM_DIM);
      }
    }
  }
  return hit;
}
