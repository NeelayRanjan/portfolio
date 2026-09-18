import type { Metadata } from "next";
import { STIX_Two_Text, Spline_Sans_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { copy } from "@/content/copy";
import { NightSky } from "@/components/manuscript/NightSky";
import { SkyCredit } from "@/components/manuscript/SkyCredit";
import { StargazeToggle } from "@/components/manuscript/StargazeToggle";
import { ReloadBeacon } from "@/components/ReloadBeacon";
import { SITE } from "@/lib/site";

const stix = STIX_Two_Text({
  variable: "--font-stix",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});
const splineMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  // Required for the relative OG image below to resolve to an absolute URL —
  // without it the card unfurls with no image at all.
  metadataBase: new URL(SITE),
  /**
   * Declared here from STABLE paths in public/, not through the app/ icon
   * file conventions (2026-09-17). Measured: a file-convention icon's link
   * carries a content hash plus, on Vercel, `?dpl=<deployment id>`, which
   * changes on every deploy, and Google asks for a stable favicon URL. The
   * same build with these config links: no query string at all. Declaring
   * `icons` in config also drops the file-based apple-icon, so the whole set
   * lives here. Google ignores SVG favicons and prefers 48px or larger, so
   * the owner's STIX-N mark ships as a 192px PNG rendered from the SVG; the
   * .ico keeps the hand-tuned 16 and 32 for browser tabs. Source artwork:
   * scripts/gen-icons.py.
   */
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32", type: "image/x-icon" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  title: copy.meta.title,
  // Same blurb as the share card: it's already the concrete, first-person
  // description written for the one place a recruiter or admissions reader
  // sees before deciding whether to click.
  description: copy.meta.blurb,
  openGraph: {
    type: "website",
    url: SITE,
    siteName: copy.meta.siteName,
    title: copy.meta.title,
    description: copy.meta.blurb,
    images: [
      {
        // A real frame of the live masthead, rendered by scripts/gen-og.mjs —
        // a screenshot of the actual page, not a mockup of it.
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: copy.meta.ogImageAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: copy.meta.title,
    description: copy.meta.blurb,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${stix.variable} ${splineMono.variable} h-full antialiased`}
    >
      <head />

      <body className="min-h-full flex flex-col font-serif">
        <NightSky />
        <StargazeToggle />
        {children}
        <SkyCredit />
        {/* Vercel Web Analytics: cookieless page views, plus the custom events
            in lib/track.ts. In production it loads same-origin from
            /_vercel/insights/, so the COOP/COEP headers never block it. */}
        <Analytics />
        {/* Speed Insights (Pro, 2026-09-16): Core Web Vitals per route and
            device. Same-origin in production, /_vercel/speed-insights/, so
            COEP never blocks it either. */}
        <SpeedInsights />
        {/* The page_reload event: the one field signal a silent tab crash
            leaves. See lib/track.ts. */}
        <ReloadBeacon />
      </body>
    </html>
  );
}
