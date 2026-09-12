import { Sheet } from "@/components/manuscript/Sheet";
import { Row, Note } from "@/components/manuscript/Row";
import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { StatBand } from "@/components/manuscript/StatBand";
import { MissionRows } from "@/components/manuscript/MissionRows";
import { Stamp } from "@/components/manuscript/Stamp";

// Task 3 smoke assembly: exercises all six manuscript primitives together so
// the responsive behaviour (rail collapse, mission-row reflow, no horizontal
// scroll) can be verified at 1280/880/400px before any later task wires in
// real content. Hardcoded strings here are fine for THIS task only — the
// copy seam (content/copy.ts) lands in Task 7, and the real page assembly
// task replaces this file's contents entirely.
export default function Home() {
  return (
    <main className="flex-1 px-4 pb-24">
      <Sheet>
        <Row
          rail={
            <div className="flex flex-col gap-4">
              <Stamp>UNDER REVIEW</Stamp>
              <Note tag="September 2026">
                A smoke assembly for the six manuscript primitives, not the
                real masthead.
              </Note>
            </div>
          }
        >
          <h1 className="mb-2 text-3xl font-semibold tracking-[-0.01em] text-ink">
            Manuscript primitives: smoke assembly
          </h1>
          <p className="max-w-[54ch] text-[15px] leading-relaxed text-mut">
            A Row anchored against a margin rail carrying a stamp and a note,
            an instrument figure with a live readout, the Table 1 stat band,
            and four real experience rows below.
          </p>
        </Row>

        <InstrumentFigure
          n="1"
          readout="n=4"
          caption="Placeholder content standing in for a real instrument figure."
        >
          <div className="grid h-32 place-items-center border border-dashed border-rule font-mono text-xs text-mut">
            figure content mounts here
          </div>
        </InstrumentFigure>

        <StatBand
          caption="The short version."
          cells={[
            {
              value: "0.882",
              label: "Dice at 16 labeled angiograms, under review at JAMIA",
              hot: true,
            },
            {
              value: "25/25",
              label: "paired runs ahead of all five baselines",
            },
            {
              value: "~75%",
              label: "faster surgeon corrections, measured",
            },
            {
              value: "553 KB",
              label: "chess engine, roughly 1900-2200 Elo, in your browser",
            },
          ]}
        />

        <h2 className="mt-16 mb-5 text-xl font-semibold text-ink">
          Experience
        </h2>
        <MissionRows
          rows={[
            {
              when: "2026–2027",
              who: "NASA Ames",
              what: "Launch and airspace coordination; synthetic ATC speech pipeline; lunar digital twin next summer",
              status: "active",
            },
            {
              when: "2024–now",
              who: "Regenstrief Institute",
              what: "x0-diffusion vessel segmentation, synthetic angiogram pipeline",
              status: "ongoing",
            },
            {
              when: "2025",
              who: "Davinci Wearables",
              what: "Agentic vision pipeline, nutrition from meal photos, under 15% error",
              status: "complete",
            },
            {
              when: "2024–2025",
              who: "V2X maintenance LLM",
              what: "Led the RAG design; hallucinations from about 40% to about 5%",
              status: "complete",
            },
          ]}
        />
      </Sheet>
    </main>
  );
}
