import { Sheet } from "@/components/manuscript/Sheet";
import { Row, Note } from "@/components/manuscript/Row";
import { Masthead } from "@/components/manuscript/Masthead";
import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { StatBand } from "@/components/manuscript/StatBand";
import { MissionRows } from "@/components/manuscript/MissionRows";
import { References } from "@/components/manuscript/References";
import { WipeFigure } from "@/components/figures/WipeFigure";
import { EfficiencyFigure } from "@/components/figures/EfficiencyFigure";
import { FlightFigure } from "@/components/figures/FlightFigure";
import { WarmKick } from "@/components/WarmKick";
import { copy } from "@/content/copy";

// The real page-one assembly (replaces Task 3's smoke content). Static
// sections only: Figures 4 and 5 (the draw and chess demos) mount into
// `#fig-draw` / `#fig-chess` in Tasks 9-10. Figure numbering, ruled: 1 (the
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
          <div id="fig-draw" />
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
