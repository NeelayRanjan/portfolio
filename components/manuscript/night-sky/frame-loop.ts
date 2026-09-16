import { stepSaturation } from "@/lib/sky-colour";
import { springStep } from "@/lib/sky-pan";
import type { SkyState } from "./state";

/**
 * The frame loop: ~20 fps at >=880px, ~10 fps below, skipped while
 * document.hidden, lifted to ~60 fps while a drag or the return spring is
 * live, or while the colour saturation eases toward a new target. Under
 * reduced motion it never runs; the sky paints on change only (and the
 * saturation snaps, pointer-controller.ts).
 */

const FRAME_MS_WIDE = 50;
const FRAME_MS_NARROW = 100;
/** A live drag or spring paints at about 60 fps, not the display's refresh
 *  rate: a 16ms gate, less 2ms so ordinary rAF jitter at 60Hz doesn't drop
 *  every other frame. */
const FRAME_MS_INTERACTING = 14;

export function createFrameLoop(s: SkyState, paint: () => void) {
  let raf = 0;
  let last = 0;

  const step = (t: number) => {
    if (!s.running) return;
    raf = requestAnimationFrame(step);
    if (document.hidden) return;
    // A live drag, spring or colour ease paints at ~60 fps; the idle sky
    // keeps its 20/10 fps gate.
    const easing = s.saturation !== s.saturationTarget;
    const interacting = s.drag !== null || s.springing || easing;
    if (easing) {
      // Real elapsed ms, closed form (lib/sky-colour.ts): the same curve at any frame rate.
      s.saturation = stepSaturation(s.saturation, s.saturationTarget, s.saturationLast ? t - s.saturationLast : 1000 / 60);
      s.saturationLast = s.saturation === s.saturationTarget ? 0 : t;
    }
    if (s.springing) {
      const r = springStep(s.offset, s.velocity, s.springLast ? t - s.springLast : 1000 / 60);
      s.springLast = t;
      s.offset = r.p;
      s.velocity = r.v;
      if (r.settled) s.springing = false;
    }
    if (t - last < (interacting ? FRAME_MS_INTERACTING : s.narrowQ.matches ? FRAME_MS_NARROW : FRAME_MS_WIDE)) return;
    last = t;
    paint();
  };
  const start = () => {
    if (s.running || s.reducedQ.matches) return;
    s.running = true;
    last = 0;
    raf = requestAnimationFrame(step);
  };
  const stop = () => {
    s.running = false;
    cancelAnimationFrame(raf);
  };
  const applyMode = () => {
    if (s.reducedQ.matches) {
      stop();
      paint();
    } else {
      start();
    }
  };

  return { stop, applyMode };
}
