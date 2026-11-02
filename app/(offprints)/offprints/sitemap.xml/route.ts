import { PIECES } from "@/content/offprints/pieces";
import { visiblePieces } from "@/lib/offprints/pieces";
import { OFFPRINTS_SITE, pieceUrl } from "@/lib/offprints/site";

// Offprints' own sitemap: the root, the index page and every visible piece
// (drafts only appear on non-production builds, like the pages themselves).
export const dynamic = "force-static";

export function GET() {
  const urls = [
    OFFPRINTS_SITE,
    `${OFFPRINTS_SITE}/all`,
    ...visiblePieces(PIECES, process.env.VERCEL_ENV).map((p) => pieceUrl(p.slug)),
  ];
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `<url><loc>${u}</loc></url>`).join("\n") +
    `\n</urlset>\n`;
  return new Response(body, { headers: { "content-type": "application/xml" } });
}
