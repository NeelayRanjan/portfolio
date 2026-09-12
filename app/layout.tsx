import type { Metadata } from "next";
import { STIX_Two_Text, Spline_Sans_Mono } from "next/font/google";
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
  // The long-form tagline lives in copy rather than in the hero, which now shows
  // the terser sub-text. Crawlers still get the full framing.
  description: copy.hero.tagline,
  openGraph: {
    type: "website",
    url: SITE,
    siteName: copy.meta.siteName,
    title: copy.meta.title,
    description: copy.meta.blurb,
    images: [
      {
        // A real frame of the live hero, rendered by scripts/gen-og.mjs — the
        // actual swarm settled into the nameplate, not a mockup of it.
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
      </body>
    </html>
  );
}
