/** A zero-delay macrotask yield for the rerouter worker (ruling R16).
 *
 *  ORT-web's session.run settles without ever returning to the worker's task
 *  queue, so a run that only awaits forwards never lets a `cancel` or a newer
 *  `reroute` message be dispatched: it posts everything first. Yielding one
 *  macrotask before each forward lets the queued message in, and the run's
 *  guard then stops it within one forward.
 *
 *  Browser workers: MessageChannel, not setTimeout(0). Measured in a Firefox
 *  worker (Playwright, 200 chained yields, 3 repeats): setTimeout(0) clamps
 *  to 4.17-4.18 ms per yield, a MessageChannel round trip costs 0.01-0.02 ms,
 *  and a message queued on the worker itself is dispatched across the first
 *  such yield.
 *
 *  Node (the tests only): setImmediate. Node drains a MessagePort's messages
 *  in one go, microtasks included, so a self-reposting channel there starves
 *  every other port and timer (measured: the queued cancel never landed); the
 *  check phase comes after poll and timers, which is the browser's ordering.
 *  No imports. */
export function makeMacrotaskYield(): () => Promise<void> {
  const g = globalThis as { setImmediate?: (cb: () => void) => unknown };
  if (typeof g.setImmediate === "function") {
    const si = g.setImmediate;
    return () => new Promise<void>((resolve) => { si(resolve); });
  }
  if (typeof MessageChannel === "undefined") return () => new Promise<void>((r) => { setTimeout(r, 0); });
  const ch = new MessageChannel();
  const waiting: (() => void)[] = [];
  ch.port1.onmessage = () => { waiting.shift()?.(); };
  return () => new Promise<void>((resolve) => {
    waiting.push(resolve);
    ch.port2.postMessage(0);
  });
}
