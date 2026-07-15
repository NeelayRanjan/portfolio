import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TimestepRail } from "@/components/ambience/TimestepRail";
import { Swarm } from "@/components/ambience/Swarm";
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

export const metadata: Metadata = {
  title: "Neelay Ranjan · generative-modeling researcher",
  // The long-form tagline lives here rather than in the hero, which now shows
  // the terser sub-text. Crawlers still get the full framing.
  description: PROFILE.tagline,
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
        {/* One fixed canvas behind all content; stations are declared in the
            page via data-swarm. Must be a body child so it spans the viewport. */}
        <Swarm />
        <TimestepRail />
        {children}
      </body>
    </html>
  );
}
