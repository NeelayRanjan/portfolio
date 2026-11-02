import type { Metadata } from "next";
import "./offprints.css";
import { shell } from "@/content/offprints/shell";
import { OFFPRINTS_SITE } from "@/lib/offprints/site";
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
  openGraph: { type: "article", siteName: shell.meta.siteName },
};

export default function OffprintsRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${stix.variable} ${splineMono.variable}`}>
      <body className="font-serif" data-op-paper>
        {children}
      </body>
    </html>
  );
}
