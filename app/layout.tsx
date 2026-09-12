import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { copy } from "@/content/copy";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head />

      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
