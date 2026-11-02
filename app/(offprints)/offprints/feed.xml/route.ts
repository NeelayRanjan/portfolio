import { PIECES } from "@/content/offprints/pieces";
import { atomFeed } from "@/lib/offprints/feed";
import { visiblePieces } from "@/lib/offprints/pieces";

// Offprints' Atom feed: visible pieces only (drafts appear on non-production
// builds, like the pages). Prerendered; `now` is the build time and only
// matters for an empty feed.
export const dynamic = "force-static";

export function GET() {
  const xml = atomFeed(visiblePieces(PIECES, process.env.VERCEL_ENV), new Date().toISOString());
  return new Response(xml, { headers: { "content-type": "application/atom+xml; charset=utf-8" } });
}
