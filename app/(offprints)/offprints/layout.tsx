import type { Metadata } from "next";
import "./offprints.css";
import { shell } from "@/content/offprints/shell";
import { OFFPRINTS_OG_IMAGE, OFFPRINTS_SITE } from "@/lib/offprints/site";
import { OffprintsAnalytics } from "@/components/offprints/OffprintsAnalytics";
import { stix, splineMono } from "@/lib/fonts";

/**
 * Offprints' root layout. A ROOT layout (html and body) because there is no
 * app/layout.tsx: the portfolio's root is app/(portfolio)/layout.tsx, and
 * none of it (the night sky, its analytics wiring, the skip link, the reload
 * beacon, globals.css) reaches these pages. Navigating between the two
 * roots is a full page load, which is fine: they are two sites.
 *
 * The body holds only the page: a piece page renders the Shell (the
 * dog-ear peel, its own `main#main` and the HomeMark); `/all` and the 404
 * render their own plain `main#main` and HomeMark. `data-op-paper` puts the
 * paper grain on the body, so every Offprints page sits on the sheet.
 */
export const metadata: Metadata = {
  // Canonicals and og:url always name the subdomain (spec §10.3), whichever
  // host served the page.
  metadataBase: new URL(OFFPRINTS_SITE),
  title: { default: shell.meta.title, template: `%s · ${shell.meta.siteName}` },
  description: shell.meta.description,
  // Stable public paths, no query string (the same rule as the portfolio's
  // icons). /offprints/<file.ext> passes through proxy.ts on every host.
  icons: {
    icon: [
      { url: "/offprints/icons/favicon.ico", sizes: "16x16 32x32", type: "image/x-icon" },
      { url: "/offprints/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/offprints/icons/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: { index: true },
  openGraph: {
    type: "article",
    siteName: shell.meta.siteName,
    images: [OFFPRINTS_OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [OFFPRINTS_OG_IMAGE.url] },
};

export default function OffprintsRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${stix.variable} ${splineMono.variable}`}>
      <body className="font-serif" data-op-paper>
        {children}
        <OffprintsAnalytics />
      </body>
    </html>
  );
}
