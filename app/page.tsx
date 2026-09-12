import { Sheet } from "@/components/manuscript/Sheet";
import { Row, Note } from "@/components/manuscript/Row";
import { Masthead } from "@/components/manuscript/Masthead";
import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { DeferredMount } from "@/components/manuscript/DeferredMount";
import { StatBand } from "@/components/manuscript/StatBand";
import { MissionRows } from "@/components/manuscript/MissionRows";
import { References } from "@/components/manuscript/References";
import { WipeFigure } from "@/components/figures/WipeFigure";
import { EfficiencyFigure } from "@/components/figures/EfficiencyFigure";
import { FlightFigure } from "@/components/figures/FlightFigure";
import { DrawDigit } from "@/components/DrawDigit";
import { WarmKick } from "@/components/WarmKick";
import { copy } from "@/content/copy";

// The real page-one assembly (replaces Task 3's smoke content). Figure 4 (the
// draw demo) now mounts here behind `DeferredMount`; Figure 5 (chess) still
// takes the `#fig-chess` slot in Task 10. `DrawDigit` owns its own
// `InstrumentFigure`, and with it the `id="fig-draw"`, so there is no
// placeholder here for it to fill. Figure numbering, ruled: 1 (the
// wipe), 2 (label efficiency), 3 (the flight day) sit in Research; 4-5 are
// the live demos; 6 is the Experience mission-row figure.
//
// The 16px page gutter is owned here (`px-4` on `main`), not by `Sheet` —
// `Sheet` only clamps its own inline padding once already inside the
// viewport margin. `body` stays background-transparent (see app/layout.tsx),
// which `DeskField`'s stacking depends on.
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
          <WipeFigure />
        </Row>

        <Row rail={<Note tag={noteCredit.tag}>{noteCredit.body}</Note>}>
          <EfficiencyFigure />
          <p className="mt-4 text-[15px] leading-relaxed text-mut">
            {copy.research.mwscas.prose}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-mut">
            {copy.research.mwscas.citation}
          </p>
        </Row>

        <p className="text-[15px] leading-relaxed text-mut">
          {copy.research.nasaProse}
        </p>
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

        <div className="grid gap-5 min-[880px]:grid-cols-2">
          {/* Figure 4 mounts on scroll-in, not at page load: the draw demo
              pulls a 26MB ONNX model on first stroke and ships its own
              client bundle, so `DeferredMount` keeps both out of first
              paint. It replaces v1's boot-log gate, which carried the same
              job under the typing theatre. */}
          <DeferredMount>
            <DrawDigit />
          </DeferredMount>
          <div id="fig-chess" />
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
      </Sheet>

      <WarmKick />
    </main>
  );
}
