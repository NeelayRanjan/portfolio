/**
 * Copies the owner's resume PDF out of the private GitHub repo into public/.
 *
 * HAND-RUN, never wired to prebuild (Vercel's build has no `gh` and no access
 * to a private repo). Its output is committed, same rule as every other
 * generator here.
 *
 *   node scripts/pull-resume.mjs            # the designed resume -> public/resume.pdf
 *   node scripts/pull-resume.mjs --ats      # the plain one       -> public/resume-ats.pdf
 *
 * WHY the site hosts its own copy (owner call, 2026-09-22): the resume now
 * lives in `NeelayRanjan/SAVE`, which is PRIVATE, so the site cannot link it
 * there. A visitor would land on GitHub's login page, and a raw URL would need
 * a token the site must never carry. Hosting the PDF ourselves also drops the
 * Google Drive dependency the Resume link used to have, which went stale the
 * moment the owner started updating GitHub instead.
 *
 * Needs `gh` authenticated with `repo` scope (`gh auth status`). The Contents
 * API returns the file base64-encoded, which is fine well under its 1 MB
 * limit; these PDFs are ~60-110 KB.
 *
 * ⚠️ Pulls ONLY the file named below. That repo also holds
 * `Unofficial Transcript.pdf` and NASA material, none of which may ever be
 * served from this site.
 *
 * ⚠️ Both resumes print the owner's phone number, so it is public the moment
 * this PDF is. `next.config.ts` sends `X-Robots-Tag: noindex` for the PDF so
 * search engines don't index the file itself (the site page is the thing that
 * should rank), but that is not privacy: anyone who opens the link sees it.
 * If the owner wants the number off the public web, it comes out of the
 * resume, not out of this script.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "NeelayRanjan/SAVE";

/** Which resume goes where. The served name is deliberately plain and stable:
 *  it is the URL people paste into applications. */
const VARIANTS = {
  public: { file: "Resume/NeelayRanjan_Resume_Public.pdf", out: "public/resume.pdf" },
  ats: { file: "Resume/NeelayRanjan_Resume_ATS.pdf", out: "public/resume-ats.pdf" },
};

const which = process.argv.includes("--ats") ? "ats" : "public";
const { file, out } = VARIANTS[which];

let raw;
try {
  raw = execFileSync("gh", ["api", `repos/${REPO}/contents/${file}`], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
} catch (err) {
  console.error(
    `pull-resume: could not read ${file} from ${REPO}.\n` +
      "Check `gh auth status` (needs repo scope on a private repo).\n" +
      String(err.stderr || err.message),
  );
  process.exit(1);
}

const meta = JSON.parse(raw);
const bytes = Buffer.from(meta.content, "base64");

// Assert before writing: a truncated or wrong-typed file must not land in
// public/ and get committed as "the resume".
if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
  console.error(`pull-resume: ${file} is not a PDF (starts ${JSON.stringify(bytes.subarray(0, 8).toString("latin1"))})`);
  process.exit(1);
}
if (bytes.length < 20_000 || bytes.length > 2_000_000) {
  console.error(`pull-resume: ${file} is ${bytes.length} bytes, outside the sane 20 KB to 2 MB range`);
  process.exit(1);
}

const sha256 = createHash("sha256").update(bytes).digest("hex");
writeFileSync(join(ROOT, out), bytes);

// Provenance, committed but NOT served (it names the private repo). The node
// test re-hashes the committed PDF against this, so a hand-edited or stale
// file in public/ fails rather than passing quietly.
const recordPath = join(ROOT, "scripts", "resume-source.json");
const record = existsSync(recordPath) ? JSON.parse(readFileSync(recordPath, "utf8")) : {};
record[which] = {
  repo: REPO,
  file,
  served: `/${out.replace(/^public\//, "")}`,
  blobSha: meta.sha,
  sha256,
  bytes: bytes.length,
  pulled: new Date().toISOString().slice(0, 10),
};
writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);

console.log(
  `pull-resume: ${file} -> ${out} (${(bytes.length / 1024).toFixed(1)} KB, blob ${meta.sha.slice(0, 8)}, sha256 ${sha256.slice(0, 12)})`,
);
