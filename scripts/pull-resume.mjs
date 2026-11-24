/**
 * Refreshes the committed FALLBACK copy of the owner's resume.
 *
 *   node scripts/pull-resume.mjs      # -> content/resume-fallback.pdf
 *
 * Since 2026-11-24 this is no longer how the site gets its resume:
 * app/resume.pdf/route.ts reads the owner's PUBLIC repo (lib/resume-source.ts)
 * and revalidates every ten minutes, so a push there reaches /resume.pdf with
 * no script and no deploy. This file only refreshes what a build prerenders
 * when GitHub can't be reached at build time. Run it when the resume changes
 * a lot, so that fallback never drifts far; skipping it breaks nothing.
 *
 * HAND-RUN, never wired to prebuild; its output is committed, same rule as
 * every other generator here. No `gh` needed: the repo is public, and the
 * unauthenticated Contents API returns the file base64-encoded with its blob
 * sha (fine well under its 1 MB limit; the PDF is ~140 KB).
 *
 * History: 2026-09-22 to 2026-11-24 this copied the PDF out of the private
 * `NeelayRanjan/SAVE` repo into public/resume.pdf, which the site served as a
 * static file. That repo also held a transcript and NASA material; nothing
 * here reads it any more. The designed (altacv) variant and its `--designed`
 * flag went with it: the public repo ships the ATS resume only.
 *
 * ⚠️ The resume prints the owner's phone number, so it is public the moment
 * the PDF is (and the repo is public anyway). `next.config.ts` sends
 * `X-Robots-Tag: noindex` for /resume.pdf so search engines don't index the
 * file itself, which is about indexing, not privacy.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RESUME_BRANCH,
  RESUME_FALLBACK,
  RESUME_FILE,
  RESUME_REPO,
  resumeProblem,
} from "../lib/resume-source.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = `https://api.github.com/repos/${RESUME_REPO}`;

async function gh(path) {
  const res = await fetch(`${api}/${path}`, {
    headers: { accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`${api}/${path} answered ${res.status}`);
  return res.json();
}

let meta;
let commit;
try {
  meta = await gh(`contents/${RESUME_FILE}?ref=${RESUME_BRANCH}`);
  [commit] = await gh(`commits?path=${RESUME_FILE}&sha=${RESUME_BRANCH}&per_page=1`);
} catch (err) {
  console.error(`pull-resume: could not read ${RESUME_FILE} from ${RESUME_REPO}.\n${String(err.message ?? err)}`);
  process.exit(1);
}

const bytes = Buffer.from(meta.content, "base64");

// Assert before writing: the same gate the route applies to what it serves.
const problem = resumeProblem(bytes);
if (problem) {
  console.error(`pull-resume: ${RESUME_FILE} is ${problem}`);
  process.exit(1);
}

const sha256 = createHash("sha256").update(bytes).digest("hex");
writeFileSync(join(ROOT, RESUME_FALLBACK), bytes);

// Provenance, committed, never served. The node test re-hashes the committed
// fallback against this, so a hand-edited or truncated file fails rather than
// passing quietly.
const record = {
  repo: RESUME_REPO,
  branch: RESUME_BRANCH,
  file: RESUME_FILE,
  fallback: RESUME_FALLBACK,
  served: "/resume.pdf",
  blobSha: meta.sha,
  commit: commit?.sha ?? null,
  committed: commit?.commit?.committer?.date ?? null,
  sha256,
  bytes: bytes.length,
  pulled: new Date().toISOString().slice(0, 10),
};
writeFileSync(join(ROOT, "scripts", "resume-source.json"), `${JSON.stringify(record, null, 2)}\n`);

console.log(
  `pull-resume: ${RESUME_REPO}/${RESUME_FILE} -> ${RESUME_FALLBACK} (${(bytes.length / 1024).toFixed(1)} KB, blob ${meta.sha.slice(0, 8)}, sha256 ${sha256.slice(0, 12)})`,
);
