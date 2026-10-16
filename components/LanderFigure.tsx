import { LanderPanel } from "@/components/LanderPanel";

/**
 * Figure 5 since 2026-10-15 (the draw demo's slot; DrawDigit moved to /lab as
 * S4). Mounted in app/page.tsx behind `DeferredMount`, like chess. The panel
 * owns its `InstrumentFigure` (id `fig-lander`), as DrawDigit and ChessPanel
 * do, because its readout comes from the module's live state.
 *
 * ⚠️ PREVIEW build (lunar_lander's titan-handoff-preview, site embedding v2):
 * not for deploy until the release handoff.
 */
export function LanderFigure() {
  return <LanderPanel />;
}
