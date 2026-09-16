import { isStargazing } from "@/lib/stargaze";
import type { SkyState } from "./state";

/**
 * The sky introduces itself once per session (discoverability spec §5): the
 * first time a hover-capable pointer moves onto the sky in paper mode, a
 * short caption (`copy.stargaze.invite`, rendered by NightSky) appears near
 * the pointer for INVITE_MS, at the same moment the colour lift starts, so
 * the two read as one response.
 *
 * Rules, each load-bearing:
 * - Never on `(hover: none)`: a phone has no pointer to drift onto the sky.
 * - Never in stargaze, never over the sheet, `pointer-events: none`.
 * - Only once the star catalog has drawn: a caption about "a real chart of
 *   the sky" over a plain dark desk would be a claim with nothing behind it. An entry
 *   that can't show it (no sky yet, no room in that margin) doesn't spend it.
 * - Once per session through `sessionStorage`; if storage throws (a private
 *   window, blocked site data), once per page load instead.
 * - Reduced motion: it appears and goes without a fade.
 * - Entering stargaze, by either door, spends it (final review m4): the
 *   invite points at a feature, and this visitor has already found it.
 *
 * `s.inviteShown` (mirrored to `window.__sky.inviteShown`) is true once it
 * has shown in THIS page load; `s.inviteBox` is its box while it is up.
 */

export const INVITE_MS = 3500;
const FADE_MS = 300;
const STORAGE_KEY = "sky-invite-shown";
/** Widest the caption gets; it wraps inside a narrower margin. */
const MAX_W = 240;
/** Narrower than this and the margin has no room for it: not shown, not spent. */
const MIN_W = 96;
const EDGE = 8;
const GAP_X = 14;
const GAP_Y = 18;

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const rectBox = (el: Element | null): Box | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
};

/** Once per page load, whatever storage says (and the only memory when it throws). */
let shownThisLoad = false;

function alreadyShown(): boolean {
  if (shownThisLoad) return true;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markShown() {
  shownThisLoad = true;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Storage refused: shownThisLoad alone keeps it to once per page load.
  }
}

export function createInvite(s: SkyState, el: HTMLElement | null) {
  const hoverQ = window.matchMedia("(hover: hover)");
  let hideTimer = 0;
  let goneTimer = 0;
  let fadeFrame = 0;

  const publish = () => {
    const w = window as Window & { __sky?: { inviteShown?: boolean; invite?: Box | null } };
    if (w.__sky) {
      w.__sky.inviteShown = s.inviteShown;
      w.__sky.invite = s.inviteBox;
    }
  };

  /** Where the caption goes for a pointer at (x, y), or null if nowhere fits. */
  const place = (node: HTMLElement, x: number, y: number): Box | null => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const sheet = rectBox(document.querySelector("[data-sheet]"));
    // The clear region the pointer is in: a side margin, or the band above or below the sheet.
    let region = { x0: EDGE, x1: W - EDGE, y0: EDGE, y1: H - EDGE };
    if (sheet) {
      if (x < sheet.x) region = { ...region, x1: sheet.x - EDGE };
      else if (x > sheet.x + sheet.w) region = { ...region, x0: sheet.x + sheet.w + EDGE };
      else if (y < sheet.y) region = { ...region, y1: sheet.y - EDGE };
      else if (y > sheet.y + sheet.h) region = { ...region, y0: sheet.y + sheet.h + EDGE };
      else return null;
    }
    const maxW = Math.min(MAX_W, region.x1 - region.x0);
    if (maxW < MIN_W) return null;
    node.style.maxWidth = `${maxW}px`;
    node.style.left = "0px";
    node.style.top = "0px";
    node.style.visibility = "hidden";
    node.hidden = false;
    const r = node.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    if (h > region.y1 - region.y0) return null;
    const obstacles = [
      sheet,
      rectBox(document.querySelector("[data-stargaze-toggle] button")),
      rectBox(document.querySelector("[data-sky-credit-body]")),
      { x: x - 6, y: y - 6, w: 12, h: 12 }, // never under the pointer itself
    ].filter((b): b is Box => b !== null);
    const clampX = (v: number) => Math.min(Math.max(v, region.x0), region.x1 - w);
    const clampY = (v: number) => Math.min(Math.max(v, region.y0), region.y1 - h);
    for (const [cx, cy] of [
      [x + GAP_X, y + GAP_Y],
      [x - GAP_X - w, y + GAP_Y],
      [x + GAP_X, y - GAP_Y - h],
      [x - GAP_X - w, y - GAP_Y - h],
    ]) {
      const box = { x: clampX(cx), y: clampY(cy), w, h };
      if (!obstacles.some((o) => overlaps(box, o))) return box;
    }
    return null;
  };

  const hide = (immediate = false) => {
    window.clearTimeout(hideTimer);
    window.clearTimeout(goneTimer);
    cancelAnimationFrame(fadeFrame);
    window.removeEventListener("scroll", onScroll);
    if (!el || el.hidden) {
      s.inviteBox = null;
      publish();
      return;
    }
    el.style.opacity = "0";
    const gone = () => {
      el.hidden = true;
      s.inviteBox = null;
      publish();
    };
    if (immediate || s.reducedQ.matches) gone();
    else goneTimer = window.setTimeout(gone, FADE_MS);
  };

  // The caption is fixed and the sheet scrolls: the moment they would meet, it goes.
  const onScroll = () => {
    const sheet = rectBox(document.querySelector("[data-sheet]"));
    if (s.inviteBox && sheet && overlaps(s.inviteBox, sheet)) hide(true);
  };

  const maybeShow = (x: number, y: number) => {
    if (!el || s.inviteShown || isStargazing() || !hoverQ.matches || !s.sky || alreadyShown()) return;
    const box = place(el, x, y);
    if (!box) {
      el.hidden = true;
      el.style.visibility = "";
      return;
    }
    markShown();
    s.inviteShown = true;
    s.inviteBox = box;
    el.style.left = `${box.x}px`;
    el.style.top = `${box.y}px`;
    el.style.visibility = "";
    el.style.transition = s.reducedQ.matches ? "none" : `opacity ${FADE_MS}ms ease`;
    el.style.opacity = s.reducedQ.matches ? "1" : "0";
    if (!s.reducedQ.matches) {
      fadeFrame = requestAnimationFrame(() => {
        fadeFrame = requestAnimationFrame(() => {
          el.style.opacity = "1";
        });
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    hideTimer = window.setTimeout(() => hide(), INVITE_MS);
    publish();
  };

  const dispose = () => {
    window.clearTimeout(hideTimer);
    window.clearTimeout(goneTimer);
    cancelAnimationFrame(fadeFrame);
    window.removeEventListener("scroll", onScroll);
  };

  /** Stargaze was entered: hide any showing caption and never show it this session. */
  const spend = () => {
    hide(true);
    markShown();
  };

  return { maybeShow, hide, spend, dispose };
}
