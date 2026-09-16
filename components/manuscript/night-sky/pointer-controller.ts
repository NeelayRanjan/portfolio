import { hitRadiusFor, nearestConstellation, nearestHit, type Highlight } from "@/lib/sky-render";
import { CLICK_SLOP_PX, PAN_LIMIT_FRAC, STARGAZE_PAN_LIMIT_FRAC, rubberBand } from "@/lib/sky-pan";
import { PAPER_SATURATION } from "@/lib/sky-colour";
import { isStargazing } from "@/lib/stargaze";
import type { CardController } from "./card-controller";
import type { SkyState } from "./state";

/**
 * The pointer on the sky: hover highlighting, drag to pan (spec 2026-09-15
 * §3), and the click that opens or closes a card in stargaze mode. Mouse or
 * pen on the desk in normal mode, any pointer anywhere while stargazing; a
 * critically damped spring (lib/sky-pan.ts, advanced by the frame loop)
 * brings the chart home on release. Reduced motion snaps home instead.
 *
 * It also decides the colour saturation's target (discoverability spec §3):
 * 1 while stargazing, 1 in paper mode while the pointer is over the sky
 * itself, PAPER_SATURATION (= PAPER_COLOUR_SHARE) otherwise and always on a device with no hover.
 * The frame loop eases toward it; reduced motion snaps.
 */

const HOVER_PX = 24;
/** Never start a pan on these: the page's own controls, and (Task 5) the card. */
const PAN_BLOCKERS = "a, button, input, select, textarea, label, summary, [role='button'], [data-sky-card], [data-sky-list-panel='open']";
/** Not the sky, for the colour target: the page's controls, the sheet, the credit line. */
const NOT_SKY = `${PAN_BLOCKERS}, [data-sheet], [data-sky-credit]`;

/** Stargaze's own chrome (the hint, the exit control, the credit): each
 *  backed box is a control and takes the pointer over itself, so a name
 *  shaded under it is neither hovered nor opened (discoverability Task 6). */
const STARGAZE_CHROME = "[data-stargaze-chrome]";
const onStargazeChrome = (target: EventTarget | null) =>
  isStargazing() && target instanceof Element && target.closest(STARGAZE_CHROME) !== null;

export type PointerControllerDeps = {
  cards: Pick<CardController, "openCard" | "closeCard">;
  paint: () => void;
  /** Paper mode: a mouse or pen pointer has just moved from off the sky onto
   *  it (the same moment the colour lift starts). The invite hangs off this. */
  onSkyEnter?: (x: number, y: number) => void;
};

export function createPointerController(s: SkyState, deps: PointerControllerDeps) {
  const { cards, paint } = deps;
  let pendingPaint = 0;
  /** The pointer cursor is showing (a selectable hit under the pointer in
   *  stargaze). A live drag's `grabbing` always wins over it. */
  let pointerCursor = false;
  const setPointerCursor = (on: boolean) => {
    if (on === pointerCursor) return;
    pointerCursor = on;
    if (!s.drag) document.documentElement.style.cursor = on ? "pointer" : "";
  };
  /** Drops the pointer cursor (leaving or entering stargaze, a drag ending);
   *  the next pointer move puts it back if something is under it. */
  const clearPointerCursor = () => {
    pointerCursor = false;
    if (!s.drag) document.documentElement.style.cursor = "";
  };

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
  /**
   * Recomputes where saturation is heading. Reduced motion jumps straight
   * there and repaints (no loop is running to ease it); otherwise the frame
   * loop picks up the change on its next step.
   *
   * `window.__skySaturationOverride` (a number) replaces the target outright.
   * It is a verify hook for scripts/verify-redesign.mjs, which needs the
   * saturation-0 frame at the same pixels to measure paper mode's colour as a
   * difference; nothing on the site sets it.
   */
  const updateSaturationTarget = () => {
    const forced = (window as Window & { __skySaturationOverride?: unknown }).__skySaturationOverride;
    const target =
      typeof forced === "number"
        ? forced
        : isStargazing() || (s.pointerOverSky && !s.noHoverQ.matches)
          ? 1
          : PAPER_SATURATION;
    if (target === s.saturationTarget && (s.running || s.saturation === target)) return;
    s.saturationTarget = target;
    if (s.reducedQ.matches || !s.running) {
      s.saturation = target;
      s.saturationLast = 0;
      paint();
    }
  };
  const setPointerOverSky = (over: boolean) => {
    if (over === s.pointerOverSky) return;
    s.pointerOverSky = over;
    updateSaturationTarget();
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
    if (target?.closest(PAN_BLOCKERS) || onStargazeChrome(target)) return;
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
    // Holding the sky is being over it, wherever the pointer wanders mid-drag.
    setPointerOverSky(true);
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
    if (!drag) {
      const el = e.target instanceof Element ? e.target : null;
      const over = !el?.closest(NOT_SKY) && !sheetContains(e.clientX, e.clientY);
      const entered = over && !s.pointerOverSky;
      setPointerOverSky(over);
      if (entered && !isStargazing()) deps.onSkyEnter?.(e.clientX, e.clientY);
    }
    // Over the open card, the list panel or stargaze's backed chrome: nothing
    // under it is being pointed at.
    if (
      (e.target instanceof Element && e.target.closest("[data-sky-card], [data-sky-list-panel='open']")) ||
      onStargazeChrome(e.target)
    ) {
      setPointerCursor(false);
      return setHighlight(null);
    }
    const next = pick(e.clientX, e.clientY, e.pointerType);
    // Stargaze only: there a click on a symbol or its name opens a card, so
    // the cursor says so. Paper-mode hovers only label, and constellation
    // lines (a 24px band over most of the sky) keep the default cursor so
    // the pointer stays a signal rather than the norm.
    setPointerCursor(isStargazing() && next?.kind === "hit");
    setHighlight(next);
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
    pointerCursor = false;
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
  const onBlur = () => {
    finishDrag(null);
    setPointerOverSky(false);
  };
  const onPointerLeave = () => {
    if (!s.drag) {
      setHighlight(null);
      setPointerOverSky(false);
      setPointerCursor(false);
    }
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
      pointerCursor = false;
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

  return { setHighlight, clearPointerCursor, settleOffset, endHeldDragForExit, updateSaturationTarget, setPointerOverSky, attach, detach };
}
