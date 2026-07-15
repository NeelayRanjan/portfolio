/**
 * Loader for the reverse-diffusion trajectories.
 *
 * The UI never knows whether the frames are real or placeholder — it reads the
 * same shape either way. Swapping in real model output means replacing
 * public/diffusion_traj.json and nothing else. See scripts/gen-placeholder-traj.mjs
 * for the exact contract.
 */

/** One reverse-process step: the noisy state, and the model's clean-image guess. */
export type Frame = {
  /** x_t — noisy state at this step. 784 values in [0,1], row-major 28x28. */
  xt: number[];
  /** x̂₀ — predicted final image at this step. Same shape. */
  x0: number[];
};

export type TrajectoryMeta = {
  /** Present only on placeholder data. Real exports omit _meta entirely. */
  synthetic?: boolean;
  note?: string;
  width?: number;
};

export type TrajectorySet = {
  meta: TrajectoryMeta | null;
  /** Digit -> frames, ordered start-of-reverse-process (noise) to finish (sample). */
  byDigit: Record<string, Frame[]>;
  /** Digits actually present in the file, sorted. */
  digits: string[];
};

export const GRID_WIDTH = 28;

/**
 * Blend two frames and reshape to rows in a single pass.
 *
 * Playback is continuous rather than frame-stepped, so at any moment it sits
 * between two stored frames. Trajectories ship with few frames (the placeholder
 * has 16); stepping them directly reads as a slideshow. Interpolating decouples
 * smoothness from however many frames the data happens to carry.
 */
export function lerpReshape(
  a: number[],
  b: number[],
  f: number,
  width: number,
): number[][] {
  const rows: number[][] = [];
  const height = a.length / width;
  for (let y = 0; y < height; y++) {
    const row = new Array<number>(width);
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      row[x] = a[i] + (b[i] - a[i]) * f;
    }
    rows.push(row);
  }
  return rows;
}

let cache: Promise<TrajectorySet> | null = null;

/** Fetches and parses the trajectory file. Cached — repeated calls share one request. */
export function loadTrajectories(): Promise<TrajectorySet> {
  if (cache) return cache;
  cache = fetch("/diffusion_traj.json")
    .then((res) => {
      if (!res.ok) throw new Error(`diffusion_traj.json: HTTP ${res.status}`);
      return res.json();
    })
    .then((raw: Record<string, unknown>) => {
      const byDigit: Record<string, Frame[]> = {};
      for (const [key, value] of Object.entries(raw)) {
        if (key.startsWith("_")) continue; // reserved: _meta and future sidecars
        if (Array.isArray(value)) byDigit[key] = value as Frame[];
      }
      const digits = Object.keys(byDigit).sort();
      if (digits.length === 0) throw new Error("diffusion_traj.json contains no digits");
      return {
        meta: (raw._meta as TrajectoryMeta) ?? null,
        byDigit,
        digits,
      };
    })
    .catch((err) => {
      cache = null; // let a later mount retry rather than cache the failure
      throw err;
    });
  return cache;
}
