# Sky card images: a real photograph above every deep-sky, planet and Moon card — design

**Date:** 2026-09-16
**Branch:** `sky-card-images` (off `main` at `62e1afc`)
**Owner's ask:** "when we pull up the card for a galaxy, nebula, or planet,
can we also add a real image of it on top? try to source only from NASA or
Wikipedia, other free to use sources like that." Layout, owner call: "a
square / rectangle that sits right above the card, where the bottom side of
the photo is the same length and is touching the top side of the card."

## 1. Why

The chart draws galaxies, nebulae and clusters as not-to-scale glyphs and
says so on every card. A real photograph beside that admission shows the
visitor what the glyph stands for, and it is the one thing on a card that
needs no words. It also extends the site's rule that everything on a card is
sourced: a photograph is a claim with an author and a license, and the card
carries both.

## 2. What gets an image, and what doesn't

**Gets one:** every deep-sky object in `objects.json` whose symbol is a
galaxy, nebula, cluster, remnant or field with a real photograph (the Hubble
Deep Field is itself a photograph), Sagittarius A* (the Event Horizon
Telescope image), the Milky Way band, the five planets, the Moon and the ISS.

**Doesn't:** the named stars (a point of light says nothing a glyph
doesn't), constellations (a photograph of a constellation is the sky the
chart already draws), meteor showers, the Voyagers (only artist's
renderings exist, and the site labels illustrative things illustrative
rather than passing them as photographs) and the Kepler field (a survey
footprint, not a subject).

The Moon's photograph cannot match the phase the chart draws at the visitor's
instant, so its credit line says which phase the photograph shows.

## 3. Sourcing rules

- **Wikimedia Commons is the index for everything**, NASA images included:
  NASA's own photographs live there under public-domain tags, and Commons'
  API returns author, license and credit for every file in one uniform shape.
  A hand-kept pick list names one Commons file per subject; nothing is
  hand-typed about its license.
- **Allowed licenses**, machine-checked at generation time from the API's
  `LicenseShortName`: `Public domain`, `CC0`, `CC BY 2.0` through `4.0`,
  `CC BY-SA 2.0` through `4.0`, and NASA / ESA-Hubble public-domain and CC BY
  variants as Commons names them. Anything else fails the generator. The
  exact allow-list lives in the generator and the node test, and the two are
  asserted equal.
- **Attribution is shown, not just stored**: the card prints the credit line
  (`Artist` from the API, HTML stripped, plus the license short name) under
  the image, and the Sources list gains a citation to the Commons file page,
  in the same `Citation` shape every fact uses.
  **Final-review fix #2 (2026-09-17)**: the sentence above once read "CC
  BY-SA needs nothing beyond the credit and the license name for display,"
  which was wrong: CC BY and CC BY-SA both ask for a link to the license
  itself and a note when the work has been modified. The card now links the
  license name (when the index carries a `licenseUrl`; public-domain entries
  don't, and stay plain text) to that license, and appends ", resized" or,
  for the two picks the pick list crops (m8, m33), ", cropped and resized"
  to the credit line.
- **Pinned bytes**: the generator records each source file's SHA-1 as Commons
  reports it, and refuses to regenerate a subject whose upstream file has
  changed unless told to re-pin. A silent upstream swap can't change a
  photograph on the site. **Its boundary** (final-review fix #10): this pins
  the upstream ORIGINAL as Commons reported it at generation time, checked
  only when the generator itself runs; it does not authenticate the fetched
  thumbnail bytes against that sha1, and it does not tie the committed WebP
  back to the pin at any later point (a build, a deploy, a visitor's load).
- **Self-hosted, never hotlinked**: the site sends
  `Cross-Origin-Embedder-Policy: require-corp`, so a cross-origin image loads
  only if its server cooperates, and hotlinking would also send every
  visitor's card opens to a third party. Each pick is downloaded once by the
  hand-run generator, downscaled to 640px on the long side, re-encoded to WebP
  at quality 80 with metadata stripped (ffmpeg, the same treatment as the
  headshot photos), and committed under `public/sky/images/<id>.webp`.
  Shipped: 35 files (spec §2's coverage list, not 55), 5 to 153 KB each,
  about 1.7 MB total (final-review fix #9), fetched only when a card opens.

## 4. Data

- **Input, hand-kept:** `scripts/sky-image-picks.json`: `{ id, file, alt,
  crop?, note? }` per subject. `file` is the Commons title
  (`File:M31_Hubble.jpg`); `alt` is real alt text describing the photograph;
  `crop` is an optional `"x,y,w,h"` fraction box for a subject that needs a
  tighter frame than the source; `note` is a per-image caption fragment (the
  Moon's phase, the instrument) where the credit alone would mislead.
- **Output, generated, committed:** `public/sky/images/index.json`:
  `{ version: 1, images: { [id]: { src, width, height, alt, credit, license,
  licenseUrl, author, sourceUrl, sourceTitle, sha1, note? } } }`, plus the
  WebP files. `src` is the served path.
- **Runtime:** `lib/sky-images.ts` loads `index.json` on the same per-layer
  gate as `objects.json` (absent → `null`, no images; malformed → throw,
  logged at the component boundary), lazily, the first time a card that
  could carry an image opens, never at page load. `card-controller.ts`'s
  `buildCard` attaches `image` to the `CardModel` when the index has the id.
  `lib/sky-render.ts` stays untouched: images are DOM, not canvas.

  **Plan-time refinement:** the index itself does not wait for a card open.
  `loadSkyLayers` already fetches every other per-layer artifact
  (`sky.json`, `objects.json`, `milkyway.json`, the ISS TLE, the sky-facts
  chunk) as one after-first-paint pass on its own gate, and `index.json` is
  small enough (~20 KB) to ride along on that same pass rather than earn its
  own trigger — a card opened before a card-open-triggered fetch resolved
  would otherwise show no photograph until reopened, which the shared gate
  avoids for free. Only the photographs themselves (~1.7 MB across 35 WebPs)
  stay lazy, fetched by the browser when a card that carries one actually
  opens (`<img loading="lazy">`), which is where the weight was always meant
  to be deferred.

## 5. Layout, per the owner

The image is the card's first child, above the title, the full width of the
card, its bottom edge on the card body's top edge with a hairline rule
between: on desktop 320px wide at a fixed 4:3 (240px tall); docked on a phone,
the full sheet width at 2:1, capped at 28dvh, `object-fit: cover`. The box's
size comes from CSS `aspect-ratio`, never from the loaded bitmap, for two
reasons: no layout shift when the file lands, and `card-controller.ts` caches
the card's `offsetHeight` at open to clamp it inside the viewport, so a
height that changed after load would let the card hang off the bottom of the
screen. The scrolling body's cap shrinks by the image's height on phones so
image plus body never exceed the old 60dvh sheet plus the image, and never
the viewport.

A card without an image (a star, a constellation) renders exactly as today.
A card whose image fails to load shows the body with no box: `onError` clears
the image, never a broken-image glyph.

The image carries `alt` from the pick list, `loading="lazy"`,
`decoding="async"`, and is inert to the sky's pointer controller like the
rest of the card.

## 6. Copy

`copy.stargaze.card` gains `imageCredit` ("Photograph: ") and
`imageMoonPhase`-style notes come from the pick list's `note`, not copy, since
they are per-image facts. All new strings pass `check-voice`.

## 7. Verification

- **Node, `scripts/test-sky-images.mjs`:** `index.json`'s shape; every entry
  has a served file, an allowed license, a non-empty author, a Commons source
  URL and alt text; every pick in the pick list has an entry and every entry a
  pick; no file under `public/sky/images/` without an entry; the allow-list
  equals the generator's; every subject §2 says gets an image has one, and no
  subject §2 excludes has one.
- **Browser, `stargaze-card-image`** (verify suite): open Andromeda's card at
  1440px: an `<img>` above the title, `naturalWidth > 0` and decoded, the box
  240px tall before and after load, the credit text present, a Sources link to
  the Commons file page; the card's bottom edge inside the viewport. Open
  Polaris: no image, markup byte-identical to today's. At 400px (touch):
  M31's docked card, image plus body within the viewport, no text under
  12px, the image box at most 28dvh. With `index.json` held: no image, no
  error, the card otherwise complete. Proved to bite by removing an index
  entry and by forcing the box's aspect off.
- The full suite and the node suite after, as always.

## 8. Not in this round

Hover previews on the desk, images for constellations, a lightbox, any
image on the chart itself. Voyager artist's renderings, ruled out above.
