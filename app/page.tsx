import { Sheet } from "@/components/manuscript/Sheet";
import { Row, Note } from "@/components/manuscript/Row";
import { Masthead } from "@/components/manuscript/Masthead";
import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { DeferredMount } from "@/components/manuscript/DeferredMount";
import { StatBand } from "@/components/manuscript/StatBand";
import { MissionRows } from "@/components/manuscript/MissionRows";
import { References } from "@/components/manuscript/References";
import { StargazeFooterEntry } from "@/components/manuscript/StargazeFooterEntry";
import { TrackedLink } from "@/components/manuscript/TrackedLink";
import { LabelEfficiencyFigure } from "@/components/figures/LabelEfficiencyFigure";
import { DiceCdfFigure } from "@/components/figures/DiceCdfFigure";
import { RerouteFigure } from "@/components/figures/RerouteFigure";
import { DrawDigit } from "@/components/DrawDigit";
import { ChessPanel } from "@/components/ChessPanel";
import { WarmKick } from "@/components/WarmKick";
import { copy } from "@/content/copy";
import type { Metadata } from "next";

/** The canonical address of this page, on the one host (lib/site.ts). */
export const metadata: Metadata = { alternates: { canonical: "/" } };

// The real page-one assembly (replaces Task 3's smoke content). Figures 4 (the
// chess engine) and 5 (the draw demo) both mount here behind `DeferredMount`.
// Each owns its own `InstrumentFigure`, and with it its `id` (`fig-draw`,
// `fig-chess`), so there are no placeholders here to fill. Figure numbering,
// ruled: 1 (the label-efficiency sweep), 2 (the Dice CDF), 3 (the SLAAC
// rerouter, in the NASA box) sit in Research; 4-5 are the live demos; 6 is the
// Experience mission-row figure. The flight-day video is /lab's S3.
//
// The 16px page gutter is owned here (`px-4` on `main`), not by `Sheet` —
// `Sheet` only clamps its own inline padding once already inside the
// viewport margin. `body` stays background-transparent (see app/layout.tsx),
// which `NightSky`'s stacking depends on.
export default function Home() {
  const dataNote = copy.research.dataNote;
  const notes = copy.research.notes;

  return (
    <main className="flex-1 px-4 pb-24">
      <Sheet>
        <Masthead />

        <StatBand
          caption={copy.table1.caption}
          cells={[...copy.table1.cells]}
        />

        <Row
          rail={
            // Desktop only: the rail starts at the row's top, but the h2 carries
            // a 60px top margin, so without this the PAPER note sits above
            // the heading.
            <div className="space-y-6 min-[880px]:pt-[60px]">
              <Note tag={notes.paper.tag}>{notes.paper.body}</Note>
              <Note tag={notes.study.tag}>{notes.study.body}</Note>
            </div>
          }
        >
          <h2
            id="research"
            className="mt-[60px] mb-5 text-[22px] font-semibold text-ink"
          >
            {copy.research.heading}
          </h2>
          {copy.research.prose.map((paragraph, i) => (
            <p key={i} className="mb-4 text-[15px] leading-relaxed text-mut">
              {paragraph}
            </p>
          ))}
        </Row>

        <Row
          rail={
            <div className="space-y-6">
              <Note tag={dataNote.tag}>
                {dataNote.pre}
                <TrackedLink
                  label="Angiogram benchmark"
                  href={dataNote.href}
                  className="text-link hover:underline hover:underline-offset-[3px]"
                >
                  {dataNote.link}
                </TrackedLink>
                {dataNote.post}
              </Note>
              <Note tag={notes.scope.tag}>{notes.scope.body}</Note>
            </div>
          }
        >
          <LabelEfficiencyFigure />
        </Row>

        <Row>
          <DiceCdfFigure />
        </Row>

        <Row
          rail={
            <Note tag={copy.research.mwscas.citeTag}>{copy.research.mwscas.citation}</Note>
          }
        >
          <p className="mt-4 text-[15px] leading-relaxed text-mut">
            {copy.research.mwscas.prose}
          </p>
        </Row>

        {/* The NASA work in its own box (owner call, 2026-09-30), separate from
            the paper above; it is the seam a fuller NASA section grows from
            later. The box has no background of its own; the figure brings
            its panel. Figure 3 is the SLAAC rerouter (the flight video moves
            to /lab), mounted on scroll-in so its JSON stays out of first
            paint. The figure's notes close the box (their own pb-6). */}
        <section
          data-nasa-box
          aria-labelledby="nasa"
          className="mt-12 border border-rule px-3 pt-5 min-[880px]:px-6 min-[880px]:pt-6"
        >
          <h3 id="nasa" className="mb-4 text-[18px] font-semibold text-ink">
            {copy.research.nasaHeading}
          </h3>
          {/* The box's provenance (2026-09-30, SLAAC round), split around the
              figure. Stacked all three in the rail beside the prose, the rail
              measured 725px against the prose's ~290px at 1280: ~430px of
              empty column between the prose and the figure. As a rail under
              the figure it left ~500px of empty main column instead. So the
              poster's numbers stay in the rail beside the prose, and the two
              notes about the figure itself (where its data came from, how it
              differs from the system NASA runs) sit under it as a footnote
              band, two columns from 880px, stacked on a phone. */}
          <Row rail={<Note tag={notes.slaac.tag}>{notes.slaac.body}</Note>}>
            {copy.research.nasaProse.map((paragraph, i) => (
              <p key={i} className="mb-4 text-[15px] leading-relaxed text-mut">
                {paragraph}
              </p>
            ))}
          </Row>
          <DeferredMount>
            <RerouteFigure />
          </DeferredMount>
          <div
            data-nasa-notes
            className="grid gap-6 border-t border-hair pt-3 pb-6 text-[13.5px] min-[880px]:grid-cols-2 min-[880px]:gap-x-12"
          >
            <Note tag={notes.data.tag}>{notes.data.body}</Note>
            <Note tag={notes.disclaimer.tag}>{notes.disclaimer.body}</Note>
          </div>
        </section>

        <Row>
          <h2
            id="systems"
            className="mt-[60px] mb-5 text-[22px] font-semibold text-ink"
          >
            {copy.systems.heading}
          </h2>
          <p className="text-[15px] leading-relaxed text-mut">
            {copy.systems.intro}
          </p>
        </Row>

        {/*
         * SINGLE COLUMN, and that is a measurement, not a preference. These two
         * figures were briefed as a `md:grid-cols-2` pair; at half the sheet's
         * width the draw demo's three 280px canvases wrap to one per row and the
         * chess board loses its move list to a stack. Full-width rows let both
         * lay out as designed. Stacked rows also stay trivially appendable: a
         * third figure is one more child, no layout work.
         *
         * Each mounts on scroll-in rather than at page load. The draw demo pulls
         * a 26MB ONNX model on first stroke, the chess panel a 553KB model plus
         * the ~24MB wasm runtime, and both ship their own client bundle, so
         * `DeferredMount` keeps all of it out of first paint. It replaces v1's
         * boot-log gate, which carried the same job under the typing theatre.
         */}
        {/* Chess before draw (owner call, 2026-09-13; the figure numbers in
            each component swapped with them, so numbering stays in page
            order). */}
        <div className="flex flex-col gap-5">
          <DeferredMount>
            <ChessPanel />
          </DeferredMount>
          <DeferredMount>
            <DrawDigit />
          </DeferredMount>
        </div>

        <Row>
          <h2
            id="experience"
            className="mt-[60px] mb-5 text-[22px] font-semibold text-ink"
          >
            {copy.experience.heading}
          </h2>
        </Row>

        <InstrumentFigure n="6" caption={copy.experience.figureCaption}>
          <MissionRows rows={[...copy.experience.rows]} />
        </InstrumentFigure>

        <References />
        <StargazeFooterEntry />
      </Sheet>

      <WarmKick />
    </main>
  );
}
