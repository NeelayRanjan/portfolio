import Link from "next/link";
import { StargazeFooterEntry } from "@/components/manuscript/StargazeFooterEntry";
import { Sheet } from "@/components/manuscript/Sheet";
import { DeferredMount } from "@/components/manuscript/DeferredMount";
import { DiffusionVisualizer } from "@/components/DiffusionVisualizer";
import { JepaSection } from "@/components/JepaPanel";
import { FlightFigure } from "@/components/figures/FlightFigure";
import { copy } from "@/content/copy";
import type { Metadata } from "next";

/** The canonical address of this page, on the one host (lib/site.ts). */
export const metadata: Metadata = { alternates: { canonical: "/lab" } };

// /lab — "Supplementary material": figures that left page 1, re-chromed with
// logic intact. Figures S1 (trajectory viewer), S2 (JEPA retrieval) and S3
// (the SLAAC flight-plan LM's synthesized day, Figure 3 on page 1 until the
// rerouter took that slot, 2026-09-30), each mounting on scroll-in. The old
// S3 (the hand-built DDPM vs flow-matching illustration) was cut 2026-09-29
// at the owner's call; it lives in git history, and comes back only as a real
// trained 2D model. Adding or removing a figure here means updating
// copy.masthead.supplementContents by hand.
//
// Every figure owns its own heading, lede and honesty notes (see each
// component); this page contributes only the back link, the page heading, and
// the one intro paragraph the brief calls for. JepaSection owns its own gate —
// when public/jepa/manifest.json is absent, the whole figure (heading and all)
// renders nothing, so there is no orphaned page furniture here to strand.
//
// Section ids keep the v1 slugs (`#diffusion`, `#jepa`) for
// continuity, not because they resolve cleanly: v1's links pointed at
// `/#diffusion` and this page is a different route, and even a link updated to
// `/lab#diffusion` can land cold on a section whose figure hasn't mounted yet
// (each one is behind DeferredMount), so the browser has nothing to scroll to.
// No redirects are built for this; it's a known gap, not a solved one.
export default function LabPage() {
  return (
    <main className="flex-1 px-4 pb-24">
      <Sheet>
        <Link
          href="/"
          className="font-mono text-[11px] text-mut transition-colors hover:text-ink"
        >
          {copy.lab.backLink}
        </Link>

        <h1 className="mt-6 mb-4 text-[22px] font-semibold text-ink">{copy.lab.heading}</h1>
        <p className="mb-6 max-w-2xl text-[15px] leading-relaxed text-mut">{copy.lab.intro}</p>

        {/*
         * No per-figure lead-in paragraphs (cut 2026-09-29: each repeated its
         * own caption). If one comes back, the figure component should render
         * it, not this page: JepaSection's gate resolves after the manifest
         * fetch, and a paragraph placed here couldn't disappear with a gated S2.
         */}
        <DeferredMount>
          <DiffusionVisualizer />
        </DeferredMount>

        <DeferredMount>
          <JepaSection />
        </DeferredMount>

        <DeferredMount>
          <FlightFigure n="S3" id="flight" heading={copy.lab.flight.heading} lede={copy.lab.flight.lede} />
        </DeferredMount>

        <StargazeFooterEntry />
      </Sheet>
    </main>
  );
}
