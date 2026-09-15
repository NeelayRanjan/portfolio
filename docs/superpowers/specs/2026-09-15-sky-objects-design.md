# Sky objects, drag, cards and the ISS: design spec

Date: 2026-09-15 · Status: implemented (plan docs/superpowers/plans/2026-09-15-sky-objects.md)
Builds on: `docs/superpowers/specs/2026-09-14-night-sky-design.md` (shipped to main locally at f15f3a1; its contracts stand unless this spec changes them).
Binding context: CLAUDE.md (Constitution, Voice, traps), including its "Night sky + stargaze" section.

> **Status note (2026-09-15, after the final whole-branch review).** Two places where what shipped differs from the text below:
> - **The pole shipped margin-based, per Ruling P1**, not at the fixed `(0.16·W, 0.18·H)` / `(0.22·W, 0.10·H)` of §2: at `(leftMargin / 2, 0.18·H)` whenever the sheet's left margin is at least 72px, else `(0.22·W, 28)`. CLAUDE.md's "Night sky + stargaze" section has the exact rule and its measurements.
> - **Voyager 2 is never drawn.** Its declination (−59.8°) is south of the chart's −35° farthest-corner edge at every width and LST. It keeps its Horizons position in `objects.json` and its fact in `content/sky-facts.ts`.
>
> The same review also changed §6's card behaviour: a card no longer closes when its subject leaves the viewport (it stays open and says the subject is out of view), names are hit targets, and a hidden keyboard list reaches every card. CLAUDE.md records the current contracts.

## 1. Owner decisions (2026-09-15)

- **Polaris moves to the top left.** The pole stops hiding behind the page (the owner found it odd).
- **Drag slides the chart** (option 2) and springs back gently on release.
- **Objects are always visible** as small symbols with names.
- **Two depths of trivia:** a one-liner on the desk (on hover), a card in stargaze mode (on click or tap).
- **Cards for everything selectable:** deep-sky objects, named stars, planets, the Moon, constellations (when and by whom they were named, their mythology), meteor showers, spacecraft, the ISS.
- **The set:** the Milky Way band, the galactic core (Sagittarius A*), Andromeda, eight Messier favourites, M87 and its black hole, the Kepler field, Voyager 1 and 2, the Hubble Deep Field, ~15 named bright stars, active meteor-shower radiants, and the ISS.
- **Facts:** paraphrased or quoted in quotation marks, each with an academic-format citation (a nod to the paper theme). The owner trusts the sourcing; there is no per-fact owner review.
- **Order:** the night sky was merged to main first; this builds on top, on branch `sky-objects`.

## 2. The chart moves: pole top left

- The north celestial pole projects to `(0.16·W, 0.18·H)` at ≥880px and `(0.22·W, 0.10·H)` below. It no longer coincides with the viewport centre.
- `k` is chosen so the viewport corner FARTHEST from the pole lands on declination −35° (was: half-diagonal at −30°). This keeps Sagittarius and the galactic core (dec −29°) on screen when the sky turns them into view.
- Orientation is unchanged: sky view facing north, up = toward the zenith over Moffett Field, east right, counterclockwise.
- `chartFor(width, height, lst)` gains the pole position and the new `k` rule; `project()` is unchanged apart from reading `cx`, `cy` from the chart.
- The hover label's sheet-avoidance (night-sky §13 / Task 5) stays; it matters less now that fewer anchors sit under the page.

## 3. Drag to pan

- **Where:** pointer-drag on the desk (never starting on the sheet, on a link, button, input, or the stargaze controls) in normal mode; anywhere in stargaze mode. Touch drag only in stargaze mode (normal-mode margins are 16px and touch there must scroll the page).
- **What:** the drag adds a screen-space offset `(ox, oy)` to the whole chart (pole, stars, lines, objects, labels). Rubber-banded beyond `0.45·min(W,H)`: past the limit, extra drag moves the chart at a fraction, never unbounded.
- **Release:** a critically damped spring returns the offset to `(0,0)`, settling in ~700ms, driven by the dt-scaled clock (`k = dt/16.67`). Reduced motion: the chart snaps back on release (drag itself still works).
- **Click vs drag:** a pointer that moves less than 5px between down and up is a click (selects in stargaze mode, §6); anything more is a drag and never selects.
- **While dragging:** hover highlighting and hover labels are suspended; the cursor is `grabbing` on the desk; `preventDefault` on a desk pointerdown stops text selection starting in the margin.
- **The sky keeps turning** during the drag and the spring (the clock never pauses).

## 4. New layers (all real data; nothing illustrative except where labelled)

Draw order, back to front: desk fill, **Milky Way band**, graticule, ecliptic, constellation lines, stars, **objects**, **meteor radiants**, planets, Moon, **ISS**, hover/selection layer.

| layer | source | drawn as |
|---|---|---|
| Milky Way band | d3-celestial `mw.json` (pinned commit 7e720a3; BSD-3), outline levels simplified at build | very faint filled polygons, cumulative low alpha, no stroke |
| Galactic core | Sagittarius A* (RA 17h45m40.04s, Dec −29°00′28.1″, J2000) | small ring + dot, label "Galactic core" |
| Messier favourites | d3-celestial `messier.json`: M1, M8, M13, M31, M42, M44, M45, M51, M57, M87 | galaxy: small tilted ellipse; nebula / remnant: dotted circle; cluster: circle of dots |
| M87* | shares M87's position; the card covers the galaxy and its black hole | (M87's galaxy symbol) |
| Named bright stars | 15 by HIP id from `stars.6.json` + `starnames.json`: Polaris, Sirius, Arcturus, Vega, Capella, Rigel, Procyon, Betelgeuse, Altair, Aldebaran, Antares, Spica, Pollux, Deneb, Regulus | the star itself; a 9px name beside it |
| Kepler field | NASA Kepler mission: centre RA 19h22m40s, Dec +44°30′, ~115 deg² | faint dashed circle of equal area (radius ≈ 6.05°), labelled "Kepler field (approximate outline)" |
| Hubble Deep Field | RA 12h36m49.4s, Dec +62°12′58″ (J2000) | a 4px square |
| Voyager 1, Voyager 2 | JPL Horizons API at build time: geocentric RA/Dec and distance on the build date | a small warm chevron + name; the card states the date of the position |
| Meteor-shower radiants | IMO Meteor Shower Calendar (curated list: Quadrantids, Lyrids, η-Aquariids, Southern δ-Aquariids, Perseids, Draconids, Southern Taurids, Northern Taurids, Orionids, Leonids, Geminids, Ursids): active window, peak, radiant at peak, peak ZHR, parent body | a small 6-ray burst, only while the simulated date is inside the active window |
| ISS | CelesTrak TLE via a same-origin cached route; `satellite.js` SGP4 in the browser | a small square with a faint halo + "ISS"; dimmed when below Moffett Field's horizon |

Symbol colours stay in the site tokens: ink and mut at low alpha for natural objects, warm for human-made things (Voyagers, ISS) and radiants, matching the planets. Below 880px objects draw symbols without always-on names (names appear on tap in stargaze).

Honesty: every card says how the object can be seen (naked eye / binoculars / telescope / not visible, a direction only), sourced. Radiants use the peak position (radiant drift ignored, stated in the card). Voyager positions are dated. The Kepler outline is labelled approximate.

## 5. Desk one-liners (normal mode, hover)

- Hover picks the nearest selectable within 12px of an object/star/planet/Moon/ISS/radiant symbol; failing that, the nearest constellation segment within 24px (existing rule). Objects win ties over lines.
- The label is the existing name label plus a second line: the entry's `oneLiner` (10px, mut). Constellations get their origin line ("One of Ptolemy’s 48, 2nd century" / "Introduced by Lacaille, 1756").
- Placement reuses the sheet-avoiding label logic.

## 6. Stargaze cards (stargaze mode, click/tap)

- A click (per §3's 5px rule) on a selectable opens a card; a click on empty sky closes it; the card's close button closes it; Escape closes the card first and only then exits stargaze.
- The card is DOM, not canvas: `components/manuscript/SkyCard.tsx`, an `aside` with `aria-labelledby`, positioned beside the selection and clamped to the viewport; below 880px it docks to the bottom as a sheet.
- Content: title (constellations: "Ursa Major (Great Bear)"), a kind line ("Galaxy · 2.5 million light-years"), 1–3 sentences (paraphrased, or quoted inside quotation marks), a visibility line, and a "Sources" list in academic format. Citation links are plain `<a target="_blank" rel="noopener">`, untracked (quota rule: no new events).
- The card follows its object as the sky turns and while dragging; it closes if the object leaves the viewport.

## 7. Facts content

- A new content file `content/sky-facts.ts`, typed, the single source of every card and one-liner. `scripts/check-voice.mjs` is extended to scan it with the same rules as `copy.ts`.
- Entry shape:
  ```ts
  type Citation = { author: string; year: string; title: string; site: string; url: string; accessed: string };
  type SkyFact = {
    id: string;                 // matches the object / planet / constellation / shower id
    kind: string;               // "Galaxy", "Open cluster", "Planet", "Constellation", …
    oneLiner: string;           // desk line, ≤ ~60 characters
    body: string[];             // 1–3 sentences for the card
    visibility: string;         // "Naked eye", "Binoculars", "Telescope", "Not visible: a direction"
    citations: Citation[];      // ≥ 1
  };
  ```
- **Citation format** (APA-style, rendered): `Author. (Year). Title. Site. Retrieved Month D, YYYY, from URL` — `year` may be "n.d.".
- **Coverage:** every drawn object, the 15 named stars, the five planets, the Moon, all 88 constellations, every meteor shower in the list, Voyager 1, Voyager 2, the ISS, the Milky Way band.
- **Constellations:** every card carries its origin (year and originator from the Wikipedia "IAU designated constellations" table: ancient/Ptolemy vs the 1598 Plancius/Keyser/de Houtman group, Hevelius 1690, Lacaille 1756) and its English meaning; mythology sentences for at least the 30 best-known (sourced to Ian Ridpath's *Star Tales* or equivalent). Constellation origin data is generated from the table, not hand-typed.
- **Planets and Moon:** where the name comes from, plus one fact each (NASA Science).
- **Accuracy rule:** every number in a card appears in its cited source. No uncited claim. Quotes are verbatim inside quotation marks; paraphrases change wording, not facts.

## 8. The ISS

- **Route:** `app/api/iss-tle/route.ts`, `export const revalidate = 7200`, `GET` fetches `https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE` and returns `{ name, line1, line2, epoch, fetchedAt }`; on any failure it returns `{ tle: null, fetchedAt }` with status 200 (so the cache keeps revalidating) and the client gates the ISS off. Visitors never contact a third party.
- **Client:** `lib/sky-iss.ts` lazy-imports `satellite.js` (a new runtime dependency, owner-requested feature; CLAUDE.md's dependency list is updated), propagates at the simulated time, and returns topocentric RA/Dec as seen from Moffett Field plus elevation, altitude (km) and speed (km/s).
- **Clock:** the ISS follows the one simulated clock, so at 180× it crosses the sky in seconds; its card says so plainly.
- **Card:** above/below the horizon over NASA Ames right now (simulated), altitude, speed, the TLE's epoch, and a CelesTrak citation.
- The route falls under the existing COOP/COEP headers (same-origin, unaffected).

## 9. Data pipeline

- `scripts/prepare-sky-objects.mjs` (hand-run, committed outputs, assert-before-write), writing:
  - `public/sky/objects.json`: Messier picks, Sgr A*, Kepler field, Hubble Deep Field, named stars (resolved by HIP), Voyager 1 and 2 from Horizons (with the query date and distance), meteor showers (with their windows), and the constellation origin table from Wikipedia.
  - `public/sky/milkyway.json`: `mw.json` simplified (coordinate rounding + point decimation), asserted under 90 KB.
- Both are fetched after first paint alongside `sky.json`; if either is absent the sky still draws without that layer; malformed throws and is logged (the §6 catalog gate, per layer).

## 10. Performance and mobile

- The new layers must not more than double the measured median frame draw time (headless Firefox, `sky-animates-1280`: 2.96 ms before this work). Recorded in the report either way.
- Milky Way vertices ≤ 4,000 after simplification; star fill styles and object symbol paths are precomputed once per catalog.
- Phones: symbols without names at rest (§4), drag only in stargaze, the card docks to the bottom.

## 11. Verification

New or changed `scripts/verify-redesign.mjs` checks (production build, :3000):
- `sky-orientation` and `sky-hover` updated for the moved pole.
- `sky-drag`: dragging in the margin changes `window.__sky.offset`; after release it returns to (0,0) within 1.5s; a drag starting on the sheet never pans; reduced motion snaps back.
- `sky-objects`: Andromeda's and the galactic core's projected positions (computed in the check from the J2000 coordinates and the spec's projection) hold drawn pixels; an active radiant appears only inside its window (pinned clock).
- `stargaze-card`: clicking Andromeda in stargaze opens a card with its title, a kind line and at least one citation link; Escape closes the card, a second Escape exits stargaze; a drag does not open a card.
- `sky-iss`: with the route intercepted to return a fixed TLE, the ISS marker is drawn and its card opens; with the route intercepted to return `{ tle: null }`, no ISS and no console error.

Node tests:
- `scripts/test-sky-objects.mjs`: objects.json and milkyway.json shape, landmark coordinates, the 15 stars resolved, shower windows valid.
- `scripts/test-sky-facts.mjs`: every id in objects.json, every planet, the Moon, all 88 constellations and every shower has a fact with a non-empty oneLiner, body, visibility and ≥1 citation (http(s) URL, accessed date).
- `scripts/test-sky-iss.mjs`: for a fixed TLE and time, `lib/sky-iss.ts`'s topocentric result agrees with satellite.js's own look angles (azimuth/elevation) converted independently.

## 12. Out of scope

Live satellites other than the ISS; the precession circle; TRAPPIST-1 / 51 Peg; JWST's deep field (below the chart edge); constellation boundaries; asterism lines; a second clock for the ISS.
