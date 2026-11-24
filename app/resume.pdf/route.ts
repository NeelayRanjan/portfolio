/**
 * /resume.pdf, read from the owner's public resume repo (owner, 2026-11-24:
 * "have the site use the one from the repo"). A push to that repo shows up
 * here within the revalidation window, with no pull script and no deploy.
 *
 * The site's second server code path, built like the first
 * (app/api/iss-tle/route.ts): prerendered at build, then revalidated.
 * `revalidate` works here because this project does not enable
 * cacheComponents (node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/route.md, "Revalidating Cached Data").
 *
 * Why the site serves the bytes instead of linking GitHub: the raw URL
 * answers `application/octet-stream` under a sandboxing CSP, so a browser
 * downloads it rather than showing it, and /resume.pdf is the URL already
 * pasted into applications.
 *
 * FAILURE, two cases, deliberately different:
 *  - While serving (a revalidation): THROW. Next then keeps the last good
 *    PDF and retries on a later request (incremental-static-regeneration.md,
 *    "Handling uncaught exceptions"). Answering with the committed fallback
 *    instead would replace a newer resume with an older one for a whole
 *    window every time GitHub hiccups.
 *  - During `next build` (the prerender): serve the committed fallback,
 *    content/resume-fallback.pdf, so a GitHub outage can't fail a deploy.
 *    The first revalidation replaces it. The file is read only in this
 *    phase, where the whole checkout is on disk, so it needs no output
 *    tracing.
 *
 * X-Robots-Tag: noindex comes from next.config.ts's header rule for this
 * path (the PDF prints a phone number; see that rule's comment), which the
 * `resume-pdf` verify check reads off the served response.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { unstable_rethrow } from "next/navigation";
import { RESUME_FALLBACK, RESUME_RAW_URL, resumeProblem } from "@/lib/resume-source";

/** Ten minutes: GitHub's own raw cache is five, and a resume pushed before an
 *  application should be the one the link opens by the time it is pasted. */
export const revalidate = 600;

async function fromRepo(): Promise<Uint8Array<ArrayBuffer>> {
  // No `cache: "no-store"`: that makes the whole route dynamic (measured: the
  // build listed it ƒ and every request would have hit GitHub). The default
  // fetch inherits this segment's `revalidate`, as the ISS route's does.
  const res = await fetch(RESUME_RAW_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`resume: ${RESUME_RAW_URL} answered ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const problem = resumeProblem(bytes);
  if (problem) throw new Error(`resume: the repo's file is ${problem}`);
  return bytes;
}

function pdf(bytes: Uint8Array<ArrayBuffer>, source: "repo" | "fallback") {
  return new Response(bytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="NeelayRanjan_Resume.pdf"',
      // Which copy this is, readable with curl -I. The verify check uses it.
      "x-resume-source": source,
    },
  });
}

export async function GET() {
  try {
    return pdf(await fromRepo(), "repo");
  } catch (err) {
    // Next signals "this route can't be static" by THROWING from fetch. The
    // fallback below once swallowed that and the build quietly shipped a
    // dynamic route; its own errors go back to it first.
    unstable_rethrow(err);
    if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) throw err;
    console.warn(`${String(err)}; this build prerenders the committed fallback`);
    // turbopackIgnore: without it the tracer sees a filesystem read off
    // process.cwd() and bundles the whole project into this function
    // (measured: "Encountered unexpected file in NFT list"). Nothing needs
    // tracing, since this line only ever runs inside `next build`.
    const bytes = new Uint8Array(await readFile(join(/* turbopackIgnore: true */ process.cwd(), RESUME_FALLBACK)));
    const problem = resumeProblem(bytes);
    if (problem) throw new Error(`resume: ${RESUME_FALLBACK} is ${problem}`);
    return pdf(bytes, "fallback");
  }
}
