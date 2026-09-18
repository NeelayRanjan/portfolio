import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * sitemap.xml (2026-09-17): the site's two pages, on the one host.
 *
 * URLs only, on purpose. Google ignores changefreq and priority, and uses
 * lastmod only when it is consistently accurate; a build timestamp would bump
 * it on every deploy whether a page changed or not. If a page is added, add it
 * here and to the 404's directory listing (CLAUDE.md: navigation listings
 * track the real set of pages).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE }, { url: `${SITE}/lab` }];
}
