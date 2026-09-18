/**
 * The site's one address (owner call, 2026-09-17: neelayranjan.dev is the
 * main host, www redirects to it). metadataBase, the canonical tags, og:url,
 * robots.txt and the sitemap all name this, so search engines get one
 * consistent answer. ⚠️ Until 2026-09-17 Vercel redirected the apex TO www,
 * the opposite of what this declares; the redirect direction is a Vercel
 * dashboard setting (Domains), not code, and the two must agree.
 */
export const SITE = "https://neelayranjan.dev";
