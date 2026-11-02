"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ReloadBeacon } from "@/components/ReloadBeacon";
import { OFFPRINTS_PREFIX } from "@/lib/offprints/host";

/**
 * Offprints' analytics, under its own prefix. On the subdomain the browser's
 * path has no /offprints (proxy.ts rewrites it), so the tracker would record
 * "/hybrid-attention" and mix with the portfolio's paths. beforeSend puts the
 * internal prefix back ("/" becomes "/offprints"), so every readout for this
 * site is filterable by it. A URL already under the prefix is left alone.
 */
export function OffprintsAnalytics() {
  return (
    <>
      <Analytics
        beforeSend={(e) => {
          const u = new URL(e.url);
          if (u.pathname !== OFFPRINTS_PREFIX && !u.pathname.startsWith(OFFPRINTS_PREFIX + "/")) {
            u.pathname = OFFPRINTS_PREFIX + (u.pathname === "/" ? "" : u.pathname);
          }
          return { ...e, url: u.toString() };
        }}
      />
      <SpeedInsights />
      <ReloadBeacon />
    </>
  );
}
