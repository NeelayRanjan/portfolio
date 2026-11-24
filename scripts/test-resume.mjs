// node --test scripts/test-resume.mjs
// The resume the site serves. Since 2026-11-24 app/resume.pdf/route.ts reads
// it from the owner's PUBLIC resume repo and revalidates, so the live bytes
// are not something a node test can pin. What it pins instead: the committed
// FALLBACK (what a build prerenders when GitHub can't be reached) against the
// provenance scripts/pull-resume.mjs recorded, the gate both the route and the
// script apply to any bytes before calling them the resume, that nothing in
// public/ shadows the route, and that the site's own links point at it.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { copy } from "../content/copy.ts";
import {
  RESUME_BRANCH,
  RESUME_FALLBACK,
  RESUME_FILE,
  RESUME_RAW_URL,
  RESUME_REPO,
  resumeProblem,
} from "../lib/resume-source.ts";

const ROOT = new URL("../", import.meta.url);
const record = JSON.parse(await readFile(new URL("scripts/resume-source.json", ROOT), "utf8"));

test("the provenance record names the public resume repo, and only it", () => {
  assert.equal(record.repo, RESUME_REPO);
  assert.equal(record.repo, "NeelayRanjan/resume", "the source is the public resume repo, never SAVE");
  assert.equal(record.branch, RESUME_BRANCH);
  assert.equal(record.file, RESUME_FILE);
  assert.equal(record.fallback, RESUME_FALLBACK);
  assert.equal(record.served, "/resume.pdf");
  assert.equal(RESUME_RAW_URL, `https://raw.githubusercontent.com/${record.repo}/${record.branch}/${record.file}`);
  assert.match(record.blobSha, /^[0-9a-f]{40}$/);
  assert.match(record.commit, /^[0-9a-f]{40}$/);
  assert.match(record.sha256, /^[0-9a-f]{64}$/);
  assert.match(record.pulled, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Number.isInteger(record.bytes) && record.bytes > 20_000);
});

test("the committed fallback is a real PDF and the exact bytes that were pulled", async () => {
  const bytes = await readFile(new URL(record.fallback, ROOT));
  assert.equal(resumeProblem(bytes), null);
  assert.equal(bytes.length, record.bytes, `${bytes.length} bytes on disk, ${record.bytes} recorded`);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    record.sha256,
    "the committed fallback is not the file pull-resume recorded; re-run scripts/pull-resume.mjs",
  );
});

test("bytes that are not a sane PDF are refused before they can be served", () => {
  const pdf = (n) => Buffer.concat([Buffer.from("%PDF-1.5\n"), Buffer.alloc(n)]);
  assert.equal(resumeProblem(pdf(50_000)), null);
  assert.match(resumeProblem(Buffer.from("<!DOCTYPE html><html>404</html>".padEnd(50_000))), /not a PDF/);
  assert.match(resumeProblem(Buffer.alloc(0)), /not a PDF/);
  assert.match(resumeProblem(pdf(100)), /outside the sane/, "a truncated download");
  assert.match(resumeProblem(pdf(3_000_000)), /outside the sane/);
});

test("nothing in public/ shadows the route", () => {
  // A static file at the same path would be served instead of the route, and
  // the site would be back to a copy that goes stale.
  for (const name of ["resume.pdf", "resume-designed.pdf", "resume-ats.pdf"]) {
    assert.ok(!existsSync(new URL(`public/${name}`, ROOT)), `public/${name} exists`);
  }
  assert.ok(existsSync(new URL("app/resume.pdf/route.ts", ROOT)), "the /resume.pdf route is gone");
});

test("the site links the resume it serves, in both places, and no longer links Drive", () => {
  const served = record.served;
  const masthead = copy.masthead.links.find((l) => l.label === "Resume");
  const reference = copy.references.items.find((l) => l.label === "Resume");
  assert.ok(masthead, "no Resume link in the masthead");
  assert.ok(reference, "no Resume entry in the references");
  assert.equal(masthead.href, served);
  assert.equal(reference.href, served);

  const every = [...copy.masthead.links, ...copy.references.items].map((l) => l.href ?? "");
  for (const href of every) {
    assert.ok(!href.includes("docs.google.com"), `a Drive URL is still linked: ${href}`);
    assert.ok(!href.includes("raw.githubusercontent.com"), `the raw GitHub URL is linked (it downloads instead of opening): ${href}`);
  }
});
