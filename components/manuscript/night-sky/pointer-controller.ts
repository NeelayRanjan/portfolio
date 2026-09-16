import { hitRadiusFor, nearestConstellation, nearestHit, type Highlight } from "@/lib/sky-render";
import { CLICK_SLOP_PX, PAN_LIMIT_FRAC, STARGAZE_PAN_LIMIT_FRAC, rubberBand } from "@/lib/sky-pan";
import { isStargazing } from "@/lib/stargaze";
import type { CardController } from "./card-controller";
import type { SkyState } from "./state";

/**
 * The pointer on the sky: hover highlighting, drag to pan (spec 2026-09-15
 * §3), and the click that opens or closes a card in stargaze mode. Mouse or
 * pen on the desk in normal mode, any pointer anywhere while stargazing; a
 * critically damped spring (lib/sky-pan.ts, advanced by the frame loop)
 * brings the chart home on release. Reduced motion snaps home instead.
 */

const HOVER_PX = 24;
/** Never start a pan on these: the page's own controls, and (Task 5) the card. */
const PAN_BLOCKERS = "a, button, input, select, textarea, label, summary, [role='button'], [data-sky-card]";

export type PointerControllerDeps = {
  cards: Pick<CardController, "openCard" | "closeCard">;
  paint: () => void;
};

export function createPointerController(s: SkyState, deps: PointerControllerDeps) {
  const { cards, paint } = deps;
  let pendingPaint = 0;

  // Normal mode: only over the desk, never over the sheet. Stargaze mode:
  // the whole screen, and a tap works too (no hover on touch).
  const sheetContains = (x: number, y: number) => {
    const el = document.querySelector("[data-sheet]");
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  /** What is under (x, y): a drawn name's box, then a symbol within the
   *  pointer type's radius (22px for touch, 12px otherwise; F1), then a
   *  constellation line within HOVER_PX. */
  const pick = (x: number, y: number, pointerType: string): Highlight | null => {
    if (!s.projected) return null;
    if (!isStargazing() && sheetContains(x, y)) return null;
    const hit = nearestHit(s.projected, x, y, hitRadiusFor(pointerType));
    if (hit) return { kind: "hit", id: hit.id, pointer: { x, y } };
    const abbr = nearestConstellation(s.projected, x, y, HOVER_PX);
    return abbr ? { kind: "constellation", id: abbr, pointer: { x, y } } : null;
  };
  const setHighlight = (next: Highlight | null) => {
    if (next === null && s.highlight === null) return;
    s.highlight = next;
    // A running loop repaints within one frame gate; a still sky (reduced
    // motion) repaints only on change.
    if (!s.running) paint();
  };
  // A still sky (reduced motion) has no loop: coalesce drag repaints to one per frame.
  const requestPaint = () => {
    if (s.running || pendingPaint) return;
    pendingPaint = requestAnimationFrame(() => {
      pendingPaint = 0;
      paint();
    });
  };

  // A pointer that never travelled CLICK_SLOP_PX: in stargaze mode, a card
  // for whatever is under it, or closing the open card on empty sky.
  const onSkyClick = (x: number, y: number, pointerType: string) => {
    if (!isStargazing()) return;
    const next = pick(x, y, pointerType);
    if (next) cards.openCard(next);
    else cards.closeCard();
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || s.drag) return;
    const stargazing = isStargazing();
    // Normal-mode margins are 16px on a phone: a touch there must scroll the page.
    if (e.pointerType === "touch" && !stargazing) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(PAN_BLOCKERS)) return;
    if (!stargazing && (target?.closest("[data-sheet]") || sheetContains(e.clientX, e.clientY))) return;
    if (!stargazing) e.preventDefault(); // no text selection starting in the margin
    s.drag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, base: { ...s.offset }, moved: false };
    s.springing = false;
    s.velocity = { x: 0, y: 0 };
    try {
      document.documentElement.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety (a release outside the window still ends the drag); never fatal.
    }
    document.documentElement.style.cursor = "grabbing";
    setHighlight(null);
  };
  const onPointerMove = (e: PointerEvent) => {
    const drag = s.drag;
    if (drag && e.pointerId === drag.id) {
      // A mouse whose button is already up: the pointerup went somewhere
      // this never heard about (a context menu, a lost capture). End the
      // drag instead of panning with no button held.
      if (e.pointerType === "mouse" && e.buttons === 0) return finishDrag(null);
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) >= CLICK_SLOP_PX) drag.moved = true;
      // Stargaze has no sheet to compose around, so it gets a looser band.
      const limitFrac = isStargazing() ? STARGAZE_PAN_LIMIT_FRAC : PAN_LIMIT_FRAC;
      s.offset = rubberBand({ x: drag.base.x + dx, y: drag.base.y + dy }, limitFrac * Math.min(s.width, s.height));
      requestPaint();
      return; // hover is suspended while dragging
    }
    if (e.pointerType === "touch") return;
    // Over the open card: nothing under it is being pointed at.
    if (e.target instanceof Element && e.target.closest("[data-sky-card]")) return setHighlight(null);
    setHighlight(pick(e.clientX, e.clientY, e.pointerType));
  };
  // Sends a non-zero offset home: an exact reduced-motion snap, or a
  // spring (change 1, 2026-09-15). Shared by a normal-mode release and by
  // leaving stargaze, so both use the same rule.
  const settleOffset = () => {
    if (s.offset.x === 0 && s.offset.y === 0) {
      s.springing = false;
      return;
    }
    if (s.reducedQ.matches) {
      s.offset = { x: 0, y: 0 };
      s.velocity = { x: 0, y: 0 };
      s.springing = false;
    } else {
      s.springing = true;
      s.springLast = 0;
    }
  };
  /** Ends the drag; `click` is the pointer's final position when it never travelled CLICK_SLOP_PX. */
  const finishDrag = (click: { x: number; y: number; pointerType: string } | null) => {
    if (!s.drag) return;
    s.drag = null;
    document.documentElement.style.cursor = "";
    if (isStargazing()) {
      // Change 1 (2026-09-15): releasing a drag while stargazing leaves
      // the chart exactly where the visitor put it. Only leaving stargaze
      // mode (NightSky's subscribeStargaze handler) sends it home.
      s.velocity = { x: 0, y: 0 };
      s.springing = false;
    } else {
      settleOffset();
      if (s.reducedQ.matches) paint();
    }
    if (click) onSkyClick(click.x, click.y, click.pointerType);
  };
  const endDrag = (e: PointerEvent) => {
    if (!s.drag || e.pointerId !== s.drag.id) return;
    finishDrag(!s.drag.moved && e.type === "pointerup" ? { x: e.clientX, y: e.clientY, pointerType: e.pointerType } : null);
  };
  // pointerup fires before lostpointercapture, so a normal release has
  // already ended the drag by now; this catches a capture lost any other way.
  const onLostCapture = (e: PointerEvent) => {
    if (s.drag && e.pointerId === s.drag.id) finishDrag(null);
  };
  const onBlur = () => finishDrag(null);
  const onPointerLeave = () => {
    if (!s.drag) setHighlight(null);
  };
  /** Leaving stargaze with a drag still held: release it without a click or a settle. */
  const endHeldDragForExit = () => {
    // Change 1 (2026-09-15): a drag held through the exit (Escape
    // mid-drag, or the exit button under a touch that's still down)
    // ends here rather than surviving into normal mode, where the next
    // pointermove would pan it with stargaze's now-gone looser limit.
    if (s.drag) {
      try {
        document.documentElement.releasePointerCapture(s.drag.id);
      } catch {
        // Same nicety as the initial capture: never fatal.
      }
      s.drag = null;
      document.documentElement.style.cursor = "";
    }
  };

  const attach = () => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", onBlur);
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.documentElement.addEventListener("lostpointercapture", onLostCapture);
  };
  const detach = () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    window.removeEventListener("blur", onBlur);
    cancelAnimationFrame(pendingPaint);
    document.documentElement.style.cursor = "";
    document.documentElement.removeEventListener("pointerleave", onPointerLeave);
    document.documentElement.removeEventListener("lostpointercapture", onLostCapture);
  };

  return { setHighlight, settleOffset, endHeldDragForExit, attach, detach };
}
