import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * robots.txt (2026-09-17). Everything is crawlable except the one API route,
 * /api/iss-tle, which is data for the sky, not a page. Prerendered at build.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
