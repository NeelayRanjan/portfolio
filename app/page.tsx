import { Sheet } from "@/components/manuscript/Sheet";
import { Row, Note } from "@/components/manuscript/Row";
import { Masthead } from "@/components/manuscript/Masthead";
import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { DeferredMount } from "@/components/manuscript/DeferredMount";
import { StatBand } from "@/components/manuscript/StatBand";
import { MissionRows } from "@/components/manuscript/MissionRows";
import { References } from "@/components/manuscript/References";
import { StargazeFooterEntry } from "@/components/manuscript/StargazeFooterEntry";
import { LabelEfficiencyFigure } from "@/components/figures/LabelEfficiencyFigure";
import { DiceCdfFigure } from "@/components/figures/DiceCdfFigure";
import { FlightFigure } from "@/components/figures/FlightFigure";
import { DrawDigit } from "@/components/DrawDigit";
import { ChessPanel } from "@/components/ChessPanel";
import { WarmKick } from "@/components/WarmKick";
import { copy } from "@/content/copy";

// The real page-one assembly (replaces Task 3's smoke content). Figures 4 (the
// chess engine) and 5 (the draw demo) both mount here behind `DeferredMount`.
// Each owns its own `InstrumentFigure`, and with it its `id` (`fig-draw`,
// `fig-chess`), so there are no placeholders here to fill. Figure numbering,
// ruled: 1 (the label-efficiency sweep), 2 (the Dice CDF), 3 (the flight
// day) sit in Research; 4-5 are the live demos; 6 is the Experience
// mission-row figure.
//
// The 16px page gutter is owned here (`px-4` on `main`), not by `Sheet` —
// `Sheet` only clamps its own inline padding once already inside the
// viewport margin. `body` stays background-transparent (see app/layout.tsx),
// which `NightSky`'s stacking depends on.
export default function Home() {
  const noteData = copy.research.noteBars[0];
  const noteCredit = copy.research.noteBars[1];

  return (
    <main className="flex-1 px-4 pb-24">
      <Sheet>
        <Masthead />

        <StatBand
          caption={copy.table1.caption}
          cells={[...copy.table1.cells]}
        />

        <Row
          rail={<Note tag="scope">{copy.research.scopeNote}</Note>}
          railAlign="end"
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

        <Row rail={<Note tag={noteData.tag}>{noteData.body}</Note>}>
          <LabelEfficiencyFigure />
        </Row>

        <Row rail={<Note tag={noteCredit.tag}>{noteCredit.body}</Note>}>
          <DiceCdfFigure />
          <p className="mt-4 text-[15px] leading-relaxed text-mut">
            {copy.research.mwscas.prose}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-mut">
            {copy.research.mwscas.citation}
          </p>
        </Row>

        <Row>
          <p className="mt-8 text-[15px] leading-relaxed text-mut">
            {copy.research.nasaProse}
          </p>
        </Row>
        <FlightFigure />

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
