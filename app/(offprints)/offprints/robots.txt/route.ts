import { OFFPRINTS_SITE } from "@/lib/offprints/site";

// Offprints' own robots.txt. On the Offprints host /robots.txt is rewritten
// here by proxy.ts; the portfolio's app/robots.ts never answers for it.
export const dynamic = "force-static";

export function GET() {
  return new Response(`User-Agent: *\nAllow: /\n\nSitemap: ${OFFPRINTS_SITE}/sitemap.xml\n`, {
    headers: { "content-type": "text/plain" },
  });
}
