/**
 * Warm heavy assets in the first idle window after first paint, so the demos
 * are ready before the visitor scrolls to them instead of loading on arrival.
 *
 * WHAT IS ACTUALLY WORTH WARMING — measured in the browser on v1's single-page
 * layout, not guessed (the trajectory JSONs have since moved to /lab, so
 * page one no longer carries them at all; the ORT finding is unchanged):
 *
 *   page load, hero only     3.63 MB   diffusion_traj.json + ascii_traj.json
 *   reaching #chess         25.01 MB   of which onnxruntime-web is 24.44 MB
 *   reaching #diffusion          0     already loaded
 *
 * Two things follow, and they are why this file warms what it warms.
 *
 * 1. The trajectory JSONs need no help. The first section sits inside the
 *    viewport at load on every size checked, so its IntersectionObserver fires
 *    immediately and the 3.63MB was already in flight on arrival.
 *    Warming them would be a no-op. This file does not bother.
 *
 * 2. The whole cost is the ORT runtime: 24.44 MB, and it is shared by BOTH model
 *    demos. Warming it is the single highest-leverage thing available, and it is
 *    also the only thing here big enough to hurt. Hence the gate below.
 *
 * NOT the draw model. `loadDrawModel()` says, in its own words, "call it on
 * first interaction (pointer-down on the canvas), never on page load. Visitors
 * who never draw shouldn't pay for it" — 25MB of ONNX on top of the runtime.
 * Drawing takes deliberate interaction, so its own rule stands. Warming ORT here
 * still pays off for it: by the time someone draws, the runtime half is done.
 */
import { loadChessEngine, unloadChessEngine } from "./chess-engine";
import { isStargazing, subscribeStargaze } from "./stargaze";

/** Once per fresh load, never per render or per remount. */
let started = false;

type Conn = { saveData?: boolean; effectiveType?: string };

/**
 * Can this visitor afford ~24MB they did not ask for?
 *
 * "Performant on mobile above all" is the spec's hardest rule and this is the
 * one place on the site that could quietly break it, so every signal here is a
 * veto and the defaults lean toward not warming.
 *
 * `navigator.connection` and `deviceMemory` are Chrome-only — Firefox and Safari
 * expose neither. So an ABSENT signal cannot mean "no": that would make this a
 * Chrome-only feature and leave every Firefox and Safari reader booting chess
 * from scratch. Absent means "unknown", and the viewport check carries the
 * decision. Known-bad still vetoes.
 *
 * The gap that leaves: a tablet on cellular, which is wide enough to pass and
 * reports nothing to contradict it. Judged acceptable — it is a small slice, and
 * the alternative penalises every desktop Firefox reader to cover it.
 */
function affordable(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;

  const conn = (navigator as Navigator & { connection?: Conn }).connection;
  // An explicit "don't" from the reader. Nothing outweighs it.
  if (conn?.saveData) return false;
  // 'slow-2g' | '2g' | '3g' | '4g'. Only veto on a value we actually got.
  if (conn?.effectiveType && conn.effectiveType !== "4g") return false;

  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === "number" && mem < 4) return false;

  // The load-bearing one, and the only signal every browser reports. Phones keep
  // today's behaviour exactly: chess loads when it is reached. effectiveType
  // would not have caught this anyway — a phone on wifi reports '4g'.
  if (!window.matchMedia("(min-width: 768px)").matches) return false;

  return true;
}

/** rIC where it exists, a timer where it doesn't (Safari). */
function whenIdle(cb: () => void) {
  const ric = (window as Window & { requestIdleCallback?: (c: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback;
  if (ric) ric(cb, { timeout: 4000 });
  else window.setTimeout(cb, 1200);
}

/**
 * Fire-and-forget. Deliberately not awaited: nothing on the page waits on it.
 */
export function warmBackground(): void {
  if (started) return;
  started = true;
  if (!affordable()) return;

  // Idle, not immediate. Creating the session costs ~1s of CPU (measured: int8
  // load 964ms), and spending it during first paint would stutter the masthead
  // and the desk field. The point is to be ready
  // before the visitor scrolls, not to be ready one second sooner.
  whenIdle(() => {
    // Stargazing is the visitor asking the page's heavy work to stop. The
    // `started` flag is already set, so this warm-up is skipped for good; the
    // chess panel still loads normally when it is reached.
    if (isStargazing()) return;

    // The real loader, not a raw fetch of the same URL. Every loader here is a
    // memoized promise, so the chess panel's own call later returns THIS promise
    // rather than starting a second download — and nothing depends on whether
    // the response happened to be cacheable.
    //
    // This also warms ORT itself, which is 24.4 of the 25MB and is shared with
    // the draw demo.
    void loadChessEngine().catch(() => {
      // A failed warm is not the visitor's problem. The section will retry and
      // report properly when it is reached; the loaders clear their own cache on
      // failure. Swallowing here keeps an offline reader out of the console.
    });
  });
}

/**
 * The idle warm-up can load the engine for a chess panel the visitor never
 * reaches, so no panel would be subscribed to unload it. Entering stargaze
 * unloads it here too; unloading twice is a no-op (the memo is already
 * null). Nothing reloads it on return: a mounted ChessPanel does that itself.
 */
if (typeof window !== "undefined") {
  subscribeStargaze((on) => {
    if (on) void unloadChessEngine();
  });
}
