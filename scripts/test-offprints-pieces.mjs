import { test } from "node:test";
import assert from "node:assert/strict";
import { PIECES } from "../content/offprints/pieces.ts";
import {
  visiblePieces,
  latestPiece,
  pieceBySlug,
  numberLabel,
  monthYear,
  dayMonthYear,
  gateOffprintsLinks,
} from "../lib/offprints/pieces.ts";
import { pieceUrl } from "../lib/offprints/site.ts";

test("production hides drafts; preview shows both, newest first", () => {
  assert.deepEqual(visiblePieces(PIECES, "production"), []);
  assert.deepEqual(
    visiblePieces(PIECES, "preview").map((p) => p.slug),
    ["hybrid-attention", "test-sheet"],
  );
});

test("published pieces sort newest first under production", () => {
  const mk = (slug, number, published) => ({
    ...PIECES[0],
    slug,
    number,
    published,
    status: "published",
  });
  const list = [mk("a", 1, "2026-11-01"), mk("b", 2, "2026-12-01")];
  assert.deepEqual(visiblePieces(list, "production").map((p) => p.slug), ["b", "a"]);
});

test("ties on date sort by number descending", () => {
  const mk = (slug, number) => ({
    ...PIECES[0],
    slug,
    number,
    published: "2026-11-01",
    status: "published",
  });
  assert.deepEqual(
    visiblePieces([mk("a", 1), mk("b", 2)], "production").map((p) => p.slug),
    ["b", "a"],
  );
});

test("latestPiece", () => {
  assert.equal(latestPiece(PIECES, "production"), null);
  assert.equal(latestPiece(PIECES, undefined).slug, "hybrid-attention");
});

// Page 1's door gate (spec §10.1): page 1 links Offprints only once a piece
// is published. Masthead and References gate on latestPiece(...) !== null.
test("door gate: production with only drafts is closed, anywhere else opens on the newest", () => {
  const draft = (slug, number, published) => ({ ...PIECES[0], slug, number, published, status: "draft" });
  const drafts = [draft("old", 1, "2026-11-01"), draft("new", 2, "2026-12-01")];
  assert.equal(latestPiece(drafts, "production"), null);
  for (const env of ["preview", "development", undefined]) {
    assert.equal(latestPiece(drafts, env).slug, "new", String(env));
  }
  const mixed = [...drafts, { ...draft("pub", 3, "2026-11-15"), status: "published" }];
  assert.equal(latestPiece(mixed, "production").slug, "pub");
});

test("door gate: the References entry for Offprints drops while the door is closed", () => {
  const items = [
    { label: "Supplementary material", href: "/lab" },
    { label: "Offprints", href: "https://offprints.neelayranjan.dev" },
    { label: "A piece", href: "https://offprints.neelayranjan.dev/x" },
  ];
  assert.deepEqual(gateOffprintsLinks(items, null).map((i) => i.label), ["Supplementary material"]);
  const open = gateOffprintsLinks(items, PIECES[1]);
  assert.deepEqual(open.map((i) => i.label), ["Supplementary material", "Offprints", "A piece"]);
});

test("pieceBySlug", () => {
  assert.equal(pieceBySlug(PIECES, "test-sheet", "production"), null);
  assert.equal(pieceBySlug(PIECES, "test-sheet", "development").number, 0);
  assert.equal(pieceBySlug(PIECES, "nope", "development"), null);
});

test("labels", () => {
  assert.equal(numberLabel(1), "No. 1");
  assert.equal(numberLabel(0), "No. 0");
  assert.equal(monthYear("2026-11-01"), "November 2026");
  assert.equal(dayMonthYear("2026-11-01"), "1 Nov 2026");
  assert.equal(dayMonthYear("2027-09-30"), "30 Sep 2027");
});

test("registry shape", () => {
  const slugs = new Set();
  for (const p of PIECES) {
    assert.ok(p.claim.length > 0 && p.claim.endsWith("."), p.slug);
    assert.ok(p.sources.length >= 1, p.slug);
    assert.match(p.slug, /^[a-z0-9-]+$/);
    assert.ok(!slugs.has(p.slug));
    slugs.add(p.slug);
  }
});

test("pieceUrl", () => {
  assert.equal(pieceUrl("hybrid-attention"), "https://offprints.neelayranjan.dev/hybrid-attention");
});
