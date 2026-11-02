// The dog-ear peel's geometry. Pure: no imports, no DOM, no React.

export const PEEL = {
  rest: 40,
  hover: 52,
  slop: 6,
  openMs: 650,
  threshold: 0.4,
  hintTo: 66,
  hintDelayMs: 1200,
  hintOutMs: 900,
  hintBackMs: 700,
} as const;

/** The viewport corner farthest from the peeled corner, plus a margin. */
export function farCorner(width: number, height: number): number {
  return width + height + 120;
}

/** The fold's distance from the corner for a pointer, clamped to [rest, farCorner]. */
export function cutFromPointer(px: number, py: number, width: number, height: number): number {
  return Math.min(Math.max(px + py, PEEL.rest), farCorner(width, height));
}

/** A release past 40% of the far corner opens the index; anything less folds back. */
export function releaseTarget(cut: number, width: number, height: number): "open" | "rest" {
  return cut >= PEEL.threshold * farCorner(width, height) ? "open" : "rest";
}

export function easeOutCubic(u: number): number {
  const v = 1 - u;
  return 1 - v * v * v;
}

/** The folded flap's outline, from the top edge down to the corner and back to the left edge. */
export function flapPath(c: number): string {
  return `M ${c} 0 Q ${c} ${c * 0.6} ${c * 0.96} ${c * 0.96} Q ${c * 0.6} ${c} 0 ${c} Z`;
}

/** The uncovered triangle the index shows through. */
export function clipPolygon(c: number): string {
  return `polygon(0 0, ${c}px 0, 0 ${c}px)`;
}

export function shadowOffset(c: number): number {
  return Math.min(10, 2 + c * 0.012);
}

export function shadowBlur(c: number): number {
  return Math.min(10, 3 + c * 0.01);
}
