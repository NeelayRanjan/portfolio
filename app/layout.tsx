import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ScrollSpine } from "@/components/ambience/ScrollSpine";
import { Swarm } from "@/components/ambience/Swarm";
import { CharField } from "@/components/ambience/CharField";
import { PROFILE } from "@/content/profile";

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

const SITE = "https://neelayranjan.dev";
/** The unfurl description. Concrete, because a share card is the one place a
 *  recruiter reads before deciding whether to click. */
const BLURB =
  "Generative-modeling researcher at NASA Ames and Regenstrief. Diffusion for " +
  "safety-critical, data-scarce domains. Three trained models run live on this " +
  "page, in your browser.";

export const metadata: Metadata = {
  // Required for the relative OG image below to resolve to an absolute URL —
  // without it the card unfurls with no image at all.
  metadataBase: new URL(SITE),
  title: "Neelay Ranjan · generative-modeling researcher",
  // The long-form tagline lives here rather than in the hero, which now shows
  // the terser sub-text. Crawlers still get the full framing.
  description: PROFILE.tagline,
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "neelayranjan.dev",
    title: "Neelay Ranjan · generative-modeling researcher",
    description: BLURB,
    images: [
      {
        // A real frame of the live hero, rendered by scripts/gen-og.mjs — the
        // actual swarm settled into the nameplate, not a mockup of it.
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "NEELAY RANJAN resolved out of a particle swarm on a near-black field",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Neelay Ranjan · generative-modeling researcher",
    description: BLURB,
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
      <head>
        {/* Sections start hidden for the scroll reveal; if JS never runs, the
            observer never fires and the page would be blank. Un-hide them. */}
        <noscript>
          <style>{`.reveal { opacity: 1 !important; transform: none !important; }`}</style>
        </noscript>
      </head>
      <body className="min-h-full flex flex-col">
        {/* Both fixed, both behind content, both body children so they span the
            viewport. CharField sits furthest back (-z-20), the swarm above it. */}
        <CharField />
        <Swarm />
        <ScrollSpine />
        {children}
      </body>
    </html>
  );
}
