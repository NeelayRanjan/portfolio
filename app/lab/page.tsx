import Link from "next/link";
import { StargazeFooterEntry } from "@/components/manuscript/StargazeFooterEntry";
import { Sheet } from "@/components/manuscript/Sheet";
import { DeferredMount } from "@/components/manuscript/DeferredMount";
import { DiffusionVisualizer } from "@/components/DiffusionVisualizer";
import { JepaSection } from "@/components/JepaPanel";
import { SampleSpace } from "@/components/SampleSpace";
import { SampleSpaceWriteup } from "@/components/SampleSpaceWriteup";
import { copy } from "@/content/copy";
import type { Metadata } from "next";

/** The canonical address of this page, on the one host (lib/site.ts). */
export const metadata: Metadata = { alternates: { canonical: "/lab" } };

// /lab — "Supplementary material": the three demos that left page 1, re-chromed
// with logic intact. Figures S1 (trajectory viewer), S2 (JEPA retrieval), S3
// (sample-space, illustrative) in that order, each mounting on scroll-in.
//
// Every figure owns its own heading, lede and honesty notes (see each
// component); this page contributes only the back link, the page heading, and
// the one intro paragraph the brief calls for. JepaSection owns its own gate —
// when public/jepa/manifest.json is absent, the whole figure (heading and all)
// renders nothing, so there is no orphaned page furniture here to strand.
//
// Section ids keep the v1 slugs (`#diffusion`, `#jepa`, `#sample-space`) for
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
         * Each figure component renders its own `sXIntro` framing paragraph
         * (copy.lab.s1Intro/s2Intro/s3Intro) immediately above its own
         * InstrumentFigure, rather than this page rendering it externally.
         * JepaSection's gate is discovered asynchronously (after the manifest
         * fetch resolves, well after this page has rendered) — a paragraph
         * placed here would have no way to disappear along with a gated S2,
         * leaving an orphaned sentence pointing at a figure that never
         * mounted. Owning the paragraph lets the component drop both at once.
         */}
        <DeferredMount>
          <DiffusionVisualizer />
        </DeferredMount>

        <DeferredMount>
          <JepaSection />
        </DeferredMount>

        <DeferredMount>
          <SampleSpace />
          <SampleSpaceWriteup />
        </DeferredMount>

        <StargazeFooterEntry />
      </Sheet>
    </main>
  );
}
