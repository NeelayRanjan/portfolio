import { InstrumentFigure } from "@/components/manuscript/InstrumentFigure";
import { LanderPanel } from "@/components/LanderPanel";
import { copy } from "@/content/copy";

/**
 * Figure 5 since 2026-10-15 (the draw demo's slot; DrawDigit moved to /lab as
 * S4). A server component: the figure chrome and caption render with the
 * page, and only the panel inside is client code. Mounted in app/page.tsx
 * behind `DeferredMount`, like chess.
 *
 * ⚠️ PREVIEW build (lunar_lander's titan-handoff-preview): the module still
 * draws its own testing UI, which the site will replace once the module
 * exposes its state and commands. Not for deploy.
 */
export function LanderFigure() {
  return (
    <InstrumentFigure n="5" id="fig-lander" caption={copy.systems.lander.figureCaption}>
      <LanderPanel />
    </InstrumentFigure>
  );
}
