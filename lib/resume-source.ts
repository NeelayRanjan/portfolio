/**
 * Where the served resume comes from (owner, 2026-11-24): the owner's PUBLIC
 * resume repo. No imports, so the route, scripts/pull-resume.mjs and
 * scripts/test-resume.mjs all read the same three facts.
 *
 * That repo holds the resume and nothing else (the PDF, its .tex, a class
 * file). The private `NeelayRanjan/SAVE` repo, which the site pulled from
 * until this date, also holds a transcript and NASA material and is no longer
 * read by anything here.
 */
export const RESUME_REPO = "NeelayRanjan/resume";
export const RESUME_BRANCH = "main";
export const RESUME_FILE = "NeelayRanjan_Resume_ATS.pdf";

/** The raw file. GitHub serves it as `application/octet-stream` under a
 *  sandboxing CSP, so a browser downloads it instead of showing it, which is
 *  why the site serves the bytes itself and never links this URL. */
export const RESUME_RAW_URL = `https://raw.githubusercontent.com/${RESUME_REPO}/${RESUME_BRANCH}/${RESUME_FILE}`;

/** The committed copy the build falls back to (never served from public/). */
export const RESUME_FALLBACK = "content/resume-fallback.pdf";

/** A truncated or wrong-typed file must never be served as "the resume".
 *  Returns the reason it is refused, or null when the bytes pass. */
export function resumeProblem(bytes: Uint8Array): string | null {
  const head = String.fromCharCode(...bytes.subarray(0, 5));
  if (head !== "%PDF-") return `not a PDF (starts ${JSON.stringify(head)})`;
  if (bytes.length < 20_000 || bytes.length > 2_000_000) {
    return `${bytes.length} bytes, outside the sane 20 KB to 2 MB range`;
  }
  return null;
}
