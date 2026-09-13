import type { Metadata } from "next";
import { STIX_Two_Text, Spline_Sans_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { copy } from "@/content/copy";
import { DeskField } from "@/components/manuscript/DeskField";

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

// A URL, not copy — metadataBase and the canonical OG url. Stays here.
const SITE = "https://neelayranjan.dev";

export const metadata: Metadata = {
  // Required for the relative OG image below to resolve to an absolute URL —
  // without it the card unfurls with no image at all.
  metadataBase: new URL(SITE),
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
        <DeskField />
        {children}
        {/* Vercel Web Analytics: cookieless page views, plus the custom events
            in lib/track.ts. In production it loads same-origin from
            /_vercel/insights/, so the COOP/COEP headers never block it. */}
        <Analytics />
      </body>
    </html>
  );
}
