/**
 * Hand-crafted trajectories over a 2D two-moons target.
 *
 * ILLUSTRATIVE. Nothing here is trained and no weights are loaded — these are
 * drawn curves chosen to show the one difference that matters: DDPM's sampling
 * path is a stochastic random walk (jagged, different every run from the same
 * start), flow matching's is a deterministic ODE (smooth, repeatable, straighter,
 * far fewer steps).
 *
 * All coordinates are normalised to [0,1] so both panels agree regardless of
 * their pixel size, and a click in one can spawn the same start in the other.
 */

export type Vec = { x: number; y: number };

/** DDPM needs many small steps; flow matching gets there in a handful. That gap
 *  is the point of the section, so it's visible in the dot counts. */
export const DDPM_STEPS = 40;
export const FLOW_STEPS = 9;

/**
 * Jitter at t=0, decaying to ~0 as the path lands on the manifold — expressed
 * as a FRACTION of the journey's length, not an absolute distance. A fixed
 * sigma reads as a tangled hairball on a short trip and as a barely-bent line
 * on a long one; scaling it keeps the jaggedness legible either way.
 *
 * Tuned against the path-length/straight-line ratio: ~2.5-3x is visibly jagged
 * while still obviously going somewhere. Much higher and the walk swamps the
 * drift entirely.
 */
const DDPM_SIGMA_FRAC = 0.1;
const DDPM_DECAY = 1.4;
/** How far a flow path bows off the straight line. Small — it's nearly straight. */
const FLOW_BOW = 0.055;

/** Deterministic [0,1) hash of a point — lets a flow path bow the same way every
 *  run from the same start, which is exactly the property being demonstrated. */
function hash01(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function gauss(rnd: () => number): number {
  const u = Math.max(rnd(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

/**
 * Two interleaving half-circles, normalised into a padded [0,1] box.
 * Deterministic: the same manifold renders on every panel and every reload.
 */
export function twoMoons(n = 320): Vec[] {
  const raw: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * Math.PI;
    const jitter = (hash01(i, 7) - 0.5) * 0.16;
    if (i % 2 === 0) {
      raw.push({ x: Math.cos(t) + jitter * 0.4, y: Math.sin(t) + jitter });
    } else {
      raw.push({ x: 1 - Math.cos(t) + jitter * 0.4, y: 0.5 - Math.sin(t) + jitter });
    }
  }
  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 0.12;
  const span = 1 - pad * 2;
  return raw.map((p) => ({
    x: pad + ((p.x - minX) / (maxX - minX)) * span,
    // Flip y: canvas grows downward.
    y: pad + (1 - (p.y - minY) / (maxY - minY)) * span,
  }));
}

/**
 * Where a start point lands on the manifold.
 *
 * Chosen by hashing the start rather than taking the nearest point: nearest
 * makes almost every path a short hop, since the noise prior sits right on top
 * of the manifold — and the whole point is watching a route from noise to data.
 * Still a pure function of the start, so flow matching stays repeatable.
 */
export function targetFor(manifold: Vec[], p: Vec): Vec {
  const i = Math.floor(hash01(p.x * 3.7, p.y * 5.3) * manifold.length);
  return manifold[Math.min(i, manifold.length - 1)];
}

/**
 * Flow matching: follow a velocity field as a deterministic ODE. Smooth, nearly
 * straight, and identical every run from the same start — the bow is derived
 * from the start point, not from RNG.
 */
export function flowPath(start: Vec, end: Vec, steps = FLOW_STEPS): Vec[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular to the straight line, for the gentle bow.
  const px = -dy / len;
  const py = dx / len;
  const bow = (hash01(start.x, start.y) - 0.5) * 2 * FLOW_BOW;

  const out: Vec[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Ease slightly so the hops bunch as it lands, like a real ODE solver.
    const e = t * t * (3 - 2 * t);
    const arc = Math.sin(t * Math.PI) * bow;
    out.push({
      x: start.x + dx * e + px * arc,
      y: start.y + dy * e + py * arc,
    });
  }
  return out;
}

/**
 * DDPM: a stochastic reverse process. Same start and target as the flow path,
 * but each step carries Gaussian jitter that decays toward the manifold, so the
 * route is jagged and different on every run.
 */
export function ddpmPath(
  start: Vec,
  end: Vec,
  rnd: () => number,
  steps = DDPM_STEPS,
): Vec[] {
  const span = Math.hypot(end.x - start.x, end.y - start.y) || 0.001;
  const out: Vec[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const sigma = DDPM_SIGMA_FRAC * span * Math.pow(1 - t, DDPM_DECAY);
    out.push({
      x: start.x + (end.x - start.x) * t + gauss(rnd) * sigma,
      y: start.y + (end.y - start.y) * t + gauss(rnd) * sigma,
    });
  }
  // Both methods must actually land on the manifold.
  out[out.length - 1] = { ...end };
  return out;
}

/** A start point drawn from the noise prior — a loose cloud over the box. */
export function sampleStart(rnd: () => number): Vec {
  return {
    x: 0.5 + gauss(rnd) * 0.26,
    y: 0.5 + gauss(rnd) * 0.26,
  };
}
