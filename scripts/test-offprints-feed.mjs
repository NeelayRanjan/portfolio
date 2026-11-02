import { test } from "node:test";
import assert from "node:assert/strict";
import { PIECES } from "../content/offprints/pieces.ts";
import { atomFeed } from "../lib/offprints/feed.ts";

const mk = (slug, number, published, extra = {}) => ({
  ...PIECES[0],
  slug,
  number,
  published,
  status: "published",
  ...extra,
});
const count = (s, t) => s.split(t).length - 1;
const FALLBACK = "2020-01-01T00:00:00.000Z";

test("escapes & < > \" in titles, claims and attributes", () => {
  const xml = atomFeed([mk("a&b", 1, "2026-11-01", { title: 'Q&A <b> "x"', claim: "a & b" })], FALLBACK);
  assert.ok(xml.includes("Q&amp;A &lt;b&gt; &quot;x&quot;"));
  assert.ok(xml.includes("a &amp; b"));
  assert.ok(xml.includes('href="https://offprints.neelayranjan.dev/a&amp;b"'));
  assert.ok(!/Q&A/.test(xml));
});

test("two pieces give two entries, in the order given (newest first)", () => {
  const xml = atomFeed([mk("new", 2, "2026-12-01"), mk("old", 1, "2026-11-01")], FALLBACK);
  assert.equal(count(xml, "<entry>"), 2);
  assert.equal(count(xml, "</entry>"), 2);
  assert.ok(xml.indexOf("/new") < xml.indexOf("/old"));
  assert.ok(xml.includes("<published>2026-12-01T00:00:00Z</published>"));
});

test("a revisit moves the entry's and the feed's updated", () => {
  const rev = { verdict: "held up", date: "2027-02-03", line: "" };
  const xml = atomFeed([mk("b", 2, "2026-12-01"), mk("a", 1, "2026-11-01", { revisit: rev })], FALLBACK);
  assert.ok(xml.includes("<updated>2027-02-03T00:00:00Z</updated>"));
  assert.ok(xml.includes("<published>2026-11-01T00:00:00Z</published>"));
  const feedUpdated = xml.split("<entry>")[0].match(/<updated>([^<]+)<\/updated>/)[1];
  assert.equal(feedUpdated, "2027-02-03T00:00:00Z");
});

test("without a revisit, updated is the published date", () => {
  const xml = atomFeed([mk("a", 1, "2026-11-01")], FALLBACK);
  assert.ok(xml.includes("<updated>2026-11-01T00:00:00Z</updated>"));
});

test("an empty feed is still a valid feed with the fallback updated", () => {
  const xml = atomFeed([], FALLBACK);
  assert.equal(count(xml, "<entry>"), 0);
  assert.equal(count(xml, "<feed "), 1);
  assert.equal(count(xml, "</feed>"), 1);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>'));
  assert.ok(xml.includes('xml:lang="en"'));
  assert.ok(xml.includes("<id>https://offprints.neelayranjan.dev/</id>"));
  assert.ok(xml.includes('<link rel="self" href="https://offprints.neelayranjan.dev/feed.xml"/>'));
  assert.ok(xml.includes('<link rel="alternate" href="https://offprints.neelayranjan.dev/"/>'));
  assert.ok(xml.includes("<author><name>Neelay Ranjan</name></author>"));
  assert.ok(xml.includes(`<updated>${FALLBACK}</updated>`));
});

test("tags balance for entry-level elements", () => {
  const xml = atomFeed([mk("a", 1, "2026-11-01"), mk("b", 2, "2026-12-01")], FALLBACK);
  for (const t of ["entry", "title", "summary", "published", "updated", "id"]) {
    assert.equal(count(xml, `<${t}>`), count(xml, `</${t}>`), t);
  }
});
