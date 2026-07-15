/**
 * Loader for the ASCII (absorbing-state discrete diffusion) trajectories.
 *
 * NOT the pixel model rendered as ASCII. Different corruption entirely: the pixel
 * model adds Gaussian noise and denoises it; this one MASKS characters and learns
 * to unmask them. Generation starts with every cell masked and commits cells one
 * at a time, most-confident first. There is no noise anywhere in it.
 *
 * Copy must reflect that: pixel = "noise sharpens into a digit", ascii = "masked
 * cells resolve into characters".
 *
 * Once a cell commits it is frozen and never re-predicted, so the animation
 * structurally cannot flicker. Verified against the export: 0 cells re-written
 * across all 10 digits.
 */

/** Bump means a breaking change to the file's shape. Refuse anything else. */
export const SUPPORTED_VERSION = 1;

export type AsciiFrame = {
  /** The grid as it entered this step: vocab indices, or maskId for undecided. */
  xt: number[];
  /** The model's guess for EVERY cell, including masked ones. Never has maskId. */
  x0: number[];
};

export type AsciiTrajSet = {
  version: number;
  /** Single-char strings. INDEX INTO THIS — never hardcode it; the model can be
   *  retuned and the file carries its own vocabulary. */
  vocab: string[];
  /** The "not yet decided" value. Deliberately outside vocab bounds. */
  maskId: number;
  rows: number;
  cols: number;
  byDigit: Record<string, AsciiFrame[]>;
  digits: string[];
};

let cache: Promise<AsciiTrajSet | null> | null = null;

/**
 * Fetches and validates the ASCII trajectories. Resolves null when the file
 * isn't there, which is what the UI gates the ascii mode on.
 */
export function loadAsciiTraj(): Promise<AsciiTrajSet | null> {
  if (cache) return cache;
  cache = (async () => {
    let raw: Record<string, unknown>;
    try {
      const res = await fetch("/ascii_traj.json");
      if (!res.ok) return null;
      raw = await res.json();
    } catch {
      return null;
    }

    const version = Number(raw.version);
    if (version !== SUPPORTED_VERSION) {
      throw new Error(
        `ascii_traj.json is version ${version}, this build understands ${SUPPORTED_VERSION}`,
      );
    }

    // Read the shape from the file. Hardcoding any of this means a retuned model
    // silently renders garbage instead of failing loudly.
    const vocab = raw.vocab as string[];
    const maskId = Number(raw.mask_id);
    const grid = raw.grid as { rows: number; cols: number };
    if (!Array.isArray(vocab) || !vocab.length) throw new Error("ascii_traj.json: no vocab");
    if (!grid?.rows || !grid?.cols) throw new Error("ascii_traj.json: no grid");

    const byDigit = (raw.digits ?? {}) as Record<string, AsciiFrame[]>;
    const digits = Object.keys(byDigit).sort();
    if (!digits.length) throw new Error("ascii_traj.json: no digits");

    return { version, vocab, maskId, rows: grid.rows, cols: grid.cols, byDigit, digits };
  })().catch((err) => {
    cache = null; // let a later mount retry rather than cache the failure
    throw err;
  });
  return cache;
}

/** What an undecided cell looks like. Dim, and never a vocab lookup. */
export const MASK_CHAR = "·";

/**
 * One frame of cell values -> rows of text.
 *
 * The maskId check MUST come before the vocab lookup: maskId is -1, and
 * `vocab[-1]` is `undefined` in JS, which renders the literal string "undefined"
 * into the grid. Any out-of-range index gets the same guard rather than trusting
 * the file.
 */
export function cellsToLines(
  cells: number[],
  vocab: string[],
  maskId: number,
  rows: number,
  cols: number,
): string[] {
  const out: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) {
      const v = cells[y * cols + x];
      if (v === maskId || v < 0 || v >= vocab.length) line += MASK_CHAR;
      else line += vocab[v];
    }
    out.push(line);
  }
  return out;
}

/** Masked cells remaining in a frame — drives the readout. */
export function maskCount(cells: number[], maskId: number): number {
  let n = 0;
  for (const v of cells) if (v === maskId) n++;
  return n;
}
