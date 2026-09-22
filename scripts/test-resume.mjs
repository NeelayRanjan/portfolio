// node --test scripts/test-resume.mjs
// The resume the site serves (2026-09-22). scripts/pull-resume.mjs copies the
// PDF out of the owner's PRIVATE GitHub repo into public/, because a private
// repo can't serve a public link and the old Drive copy went stale. This pins
// the committed file against the provenance the pull recorded, so a truncated,
// hand-edited or half-updated PDF fails here rather than shipping quietly, and
// pins that the site's own links actually point at it.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { copy } from "../content/copy.ts";

const ROOT = new URL("../", import.meta.url);
const record = JSON.parse(await readFile(new URL("scripts/resume-source.json", ROOT), "utf8"));

test("the provenance record is complete", () => {
  assert.ok(record.public, "no record for the served resume");
  for (const [which, r] of Object.entries(record)) {
    assert.equal(r.repo, "NeelayRanjan/SAVE", which);
    assert.match(r.file, /^Resume\/.+\.pdf$/, `${which}: pulled from outside Resume/`);
    assert.match(r.served, /^\/resume[a-z-]*\.pdf$/, which);
    assert.match(r.blobSha, /^[0-9a-f]{40}$/, which);
    assert.match(r.sha256, /^[0-9a-f]{64}$/, which);
    assert.match(r.pulled, /^\d{4}-\d{2}-\d{2}$/, which);
    assert.ok(Number.isInteger(r.bytes) && r.bytes > 20_000, which);
  }
});

test("every recorded PDF is committed, a real PDF, and the exact bytes that were pulled", async () => {
  for (const [which, r] of Object.entries(record)) {
    const bytes = await readFile(new URL(`public${r.served}`, ROOT));
    assert.equal(bytes.subarray(0, 5).toString("latin1"), "%PDF-", `${which}: not a PDF`);
    assert.equal(bytes.length, r.bytes, `${which}: ${bytes.length} bytes on disk, ${r.bytes} recorded`);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      r.sha256,
      `${which}: the committed PDF is not the file pull-resume recorded; re-run scripts/pull-resume.mjs`,
    );
  }
});

test("the site links the resume it serves, in both places, and no longer links Drive", () => {
  const served = record.public.served;
  const masthead = copy.masthead.links.find((l) => l.label === "Resume");
  const reference = copy.references.items.find((l) => l.label === "Resume");
  assert.ok(masthead, "no Resume link in the masthead");
  assert.ok(reference, "no Resume entry in the references");
  assert.equal(masthead.href, served);
  assert.equal(reference.href, served);

  const every = [...copy.masthead.links, ...copy.references.items].map((l) => l.href ?? "");
  for (const href of every) {
    assert.ok(!href.includes("docs.google.com"), `a Drive URL is still linked: ${href}`);
  }
});
