import { copy } from "@/content/copy";
import { SECRET_FADE_MS, SECRET_HOLD_MS } from "@/lib/sky-secret";
import type { SkyState } from "./state";

/**
 * The secret door's caption (Task 17, owner-approved 2026-10-01). Shown only
 * when stargaze was entered by clicking a constellation in the sky
 * (`via: "sky"`), never for the toggle or the footer door: it fades in over
 * SECRET_FADE_MS, holds SECRET_HOLD_MS, fades out. Reduced motion: no fades.
 * Leaving stargaze removes it at once.
 *
 * Not a modal: `pointer-events: none`, so drag, clicks and cards work
 * through it, and Escape still exits stargaze. Centred in the upper middle,
 * below the hint bar (`--stargaze-hint-h`, NightSky's markup), on the
 * chrome's desk-toned pill.
 *
 * Announced once: the wrapper is a polite live region that is always in the
 * DOM, and the text is written into it only when the caption shows, so the
 * change is what a screen reader hears (unlike the hover invite, this follows
 * a deliberate click). Hiding clears the text.
 *
 * `s.secretShown` (mirrored to `window.__sky.secretShown`) is true while it
 * is up.
 */
export function createSecretDoor(s: SkyState, el: HTMLElement | null) {
  let holdTimer = 0;
  let goneTimer = 0;
  let fadeFrame = 0;

  const publish = () => {
    const w = window as Window & { __sky?: { secretShown?: boolean } };
    if (w.__sky) w.__sky.secretShown = s.secretShown;
  };
  const clearTimers = () => {
    window.clearTimeout(holdTimer);
    window.clearTimeout(goneTimer);
    cancelAnimationFrame(fadeFrame);
  };

  const hide = (immediate = false) => {
    clearTimers();
    if (!el || el.hidden) {
      s.secretShown = false;
      publish();
      return;
    }
    const gone = () => {
      el.hidden = true;
      el.textContent = "";
      s.secretShown = false;
      publish();
    };
    if (immediate || s.reducedQ.matches) {
      el.style.transition = "none";
      el.style.opacity = "0";
      gone();
      return;
    }
    el.style.transition = `opacity ${SECRET_FADE_MS}ms ease`;
    el.style.opacity = "0";
    goneTimer = window.setTimeout(gone, SECRET_FADE_MS);
  };

  const show = () => {
    if (!el) return;
    clearTimers();
    const reduced = s.reducedQ.matches;
    el.style.transition = reduced ? "none" : `opacity ${SECRET_FADE_MS}ms ease`;
    el.style.opacity = reduced ? "1" : "0";
    el.textContent = copy.stargaze.secretMessage;
    el.hidden = false;
    s.secretShown = true;
    publish();
    if (!reduced) {
      // Two frames: the hidden -> shown change has to be styled at 0 first,
      // or the browser skips straight to 1 with no transition.
      fadeFrame = requestAnimationFrame(() => {
        fadeFrame = requestAnimationFrame(() => {
          el.style.opacity = "1";
        });
      });
    }
    holdTimer = window.setTimeout(() => hide(), (reduced ? 0 : SECRET_FADE_MS) + SECRET_HOLD_MS);
  };

  return { show, hide, dispose: clearTimers };
}
