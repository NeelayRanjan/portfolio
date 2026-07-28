/**
 * Loader for the MAE vs I-JEPA representation bundle.
 *
 * Nothing runs a model here. Two encoders were pretrained offline on STL-10's
 * 100k unlabeled split with identical architecture, masking, optimiser, schedule
 * and seed — the only difference is what they predict for the hidden patches
 * (MAE: pixels; I-JEPA: the representations an EMA copy of the encoder produces).
 * The export is the *result*: labels, top-8 neighbours per image, the probe
 * numbers, and two UMAP fits the site no longer renders (see JepaManifest).
 * This file fetches and validates it.
 *
 * ⚠️ GATED ON THE ARTIFACTS' ABSENCE, per the site's central rule. Both loaders
 * resolve `null` when their file isn't there, and the section unmounts rather
 * than rendering. There is no placeholder mode and there must not be one: a
 * fabricated neighbour grid would teach exactly the wrong thing about which
 * encoder confuses what, which is the entire content of the demo.
 *
 * The distinction between `null` and `throw` matters and mirrors
 * lib/chess-activations.ts: **absent resolves null** (the file was never
 * shipped — gate), **malformed throws** (the file is there and wrong — that is a
 * bug in the export, and swallowing it would hide it forever).
 */

/** Encoder keys AS THEY APPEAR IN THE FILE. `jepa`, not `ijepa` — the display
 *  name is "I-JEPA" but the manifest key is not, and conflating them silently
 *  yields `undefined` arrays rather than an error. */
export const ENCODERS = ["mae", "jepa"] as const;
export type Encoder = (typeof ENCODERS)[number];

/** Where the bundle lives. Both files must sit together. */
const DIR = "/jepa";
const MANIFEST_URL = `${DIR}/manifest.json`;

export type EncoderMetrics = { linear_probe: number; knn: number };

export type JepaMetrics = {
  mae: EncoderMetrics;
  jepa: EncoderMetrics;
  backbone: string;
  params: number;
  pretrain_epochs: number;
  pretrain_images: number;
  masking: string;
};

export type SpriteGeom = {
  file: string;
  /** Edge of one thumbnail in the atlas, px. */
  thumb: number;
  cols: number;
  rows: number;
};

/**
 * ⚠️ `umap.mae` / `umap.jepa` ARE IN THE BUNDLE AND ARE DELIBERATELY NOT PARSED,
 * so they are absent from this type on purpose rather than by oversight. They fed
 * a two-panel scatter view that was built, shipped and then removed (CLAUDE.md §7
 * has the reason, plus the honesty note that must come back with it). Parsing a
 * field nothing renders is dead weight, and the data is still in the file for
 * whoever restores the view.
 */
export type JepaManifest = {
  classes: string[];
  n: number;
  sprite: SpriteGeom;
  /** Resolved URL of the atlas, so callers never rebuild the path. */
  spriteUrl: string;
  /** True class index per image. */
  labels: number[];
  /** Top-k indices per image, nearest first, self excluded. */
  neighbors: Record<Encoder, number[][]>;
  /** Neighbours per image, READ FROM THE DATA rather than assumed to be 8. */
  k: number;
  /** Pinned starter queries, chosen by purity gap rather than by eye. */
  seedQueries: number[];
  metrics: JepaMetrics;
  /** Mean over all n images of the fraction of neighbours sharing the label.
   *  Optional: an older export may not carry it, and the aggregate readout
   *  simply doesn't render then. */
  meanPurity?: Record<Encoder, number>;
  dataset: string;
  split: string;
};

const isNumArray = (v: unknown, len: number) => Array.isArray(v) && v.length === len;

let manifestCache: Promise<JepaManifest | null> | null = null;

/**
 * Fetch and validate manifest.json.
 *
 * Every length check here guards a silent off-by-N. `labels` and `neighbors.*`
 * are indexed by the same image id, so a manifest whose arrays disagree would
 * render one image's thumbnail under another's class name with no error
 * anywhere — a wrong answer that looks exactly like a right one.
 */
export function loadJepaManifest(): Promise<JepaManifest | null> {
  if (manifestCache) return manifestCache;
  manifestCache = (async () => {
    let raw: Record<string, unknown>;
    try {
      const res = await fetch(MANIFEST_URL);
      if (!res.ok) return null; // not shipped -> gate, don't throw
      raw = await res.json();
    } catch {
      return null;
    }

    const n = Number(raw.n);
    const classes = raw.classes as string[];
    const labels = raw.labels as number[];
    const sprite = raw.sprite as SpriteGeom;

    if (!Number.isInteger(n) || n <= 0) throw new Error(`jepa manifest: bad n ${raw.n}`);
    if (!Array.isArray(classes) || !classes.length) throw new Error("jepa manifest: no classes");
    if (!isNumArray(labels, n)) throw new Error(`jepa manifest: labels != n (${n})`);
    if (!sprite || !sprite.file || !sprite.thumb || !sprite.cols || !sprite.rows) {
      throw new Error("jepa manifest: incomplete sprite geometry");
    }
    // The atlas has to be big enough to hold every image, or the last rows index
    // off the bottom of the sheet and render as empty squares.
    if (sprite.cols * sprite.rows < n) {
      throw new Error(
        `jepa manifest: atlas ${sprite.cols}x${sprite.rows} holds ${sprite.cols * sprite.rows} < n ${n}`,
      );
    }
    for (const l of labels) {
      if (!Number.isInteger(l) || l < 0 || l >= classes.length) {
        throw new Error(`jepa manifest: label ${l} outside 0..${classes.length - 1}`);
      }
    }

    const nbrRaw = (raw.neighbors ?? {}) as Record<string, number[][]>;
    const neighbors = {} as Record<Encoder, number[][]>;
    let k = 0;

    for (const e of ENCODERS) {
      const nb = nbrRaw[e];
      if (!isNumArray(nb, n)) throw new Error(`jepa manifest: neighbors.${e} != n (${n})`);
      const kk = nb[0]?.length ?? 0;
      if (!kk) throw new Error(`jepa manifest: neighbors.${e} carries no neighbours`);
      // Both encoders must expose the same k, or the two rows in the UI are
      // different-length samples and their purity fractions aren't comparable.
      if (k && kk !== k) throw new Error(`jepa manifest: neighbors k differs (${k} vs ${kk})`);
      k = kk;
      neighbors[e] = nb;
    }

    const metrics = raw.metrics as JepaMetrics;
    if (!metrics?.mae || !metrics?.jepa) throw new Error("jepa manifest: metrics missing");

    // Pinned queries are indices into THIS bundle, not the source split.
    const seedQueries = ((raw.seed_queries as number[]) ?? []).filter(
      (i) => Number.isInteger(i) && i >= 0 && i < n,
    );

    const purityRaw = raw.mean_neighbor_purity as Record<string, number> | undefined;
    const meanPurity =
      purityRaw && typeof purityRaw.mae === "number" && typeof purityRaw.jepa === "number"
        ? { mae: purityRaw.mae, jepa: purityRaw.jepa }
        : undefined;

    return {
      classes,
      n,
      sprite,
      spriteUrl: `${DIR}/${sprite.file}`,
      labels,
      neighbors,
      k,
      seedQueries,
      metrics,
      meanPurity,
      dataset: String(raw.dataset ?? ""),
      split: String(raw.split ?? ""),
    };
  })().catch((err) => {
    manifestCache = null; // let a later mount retry rather than caching the failure
    throw err;
  });
  return manifestCache;
}

const spriteCache = new Map<string, Promise<HTMLImageElement | null>>();

/**
 * Decode the thumbnail atlas.
 *
 * Resolves null if it 404s, which gates the section exactly like a missing
 * manifest — a neighbour grid of empty squares is worse than no section.
 *
 * It is loaded as an <img> and then handed to CSS `background-image` rather than
 * drawn through canvas: the browser decodes the 3072x3072 sheet once and every
 * thumbnail on the page is a background-position offset into that one decode. We
 * only await it to know when it is safe to show them.
 */
export function loadJepaSprites(url: string): Promise<HTMLImageElement | null> {
  const hit = spriteCache.get(url);
  if (hit) return hit;
  const p = new Promise<HTMLImageElement | null>((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  spriteCache.set(url, p);
  return p;
}

/**
 * CSS for one thumbnail, as a percentage-based sprite window.
 *
 * ⚠️ PERCENTAGES, NOT PIXELS, and that is what makes the thumbnails responsive.
 * With `background-size: cols*100%`, the sheet is `cols` times the element's
 * width, and a background-position of X% resolves to `X% * (elementW - sheetW)`,
 * i.e. `-X% * (cols-1) * elementW`. Landing on column `c` therefore wants
 * `X = c / (cols - 1)`. Pixel offsets would have to be recomputed on every
 * resize; this one is correct at any size the grid happens to be.
 */
export function spriteCell(m: JepaManifest, i: number) {
  const { cols, rows } = m.sprite;
  const col = i % cols;
  const row = Math.floor(i / cols);
  return {
    backgroundImage: `url(${m.spriteUrl})`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${(col / (cols - 1)) * 100}% ${(row / (rows - 1)) * 100}%`,
  } as const;
}

/** How many of `query`'s neighbours share its true class. The demo's readout. */
export function purity(m: JepaManifest, e: Encoder, query: number): number {
  const want = m.labels[query];
  return m.neighbors[e][query].reduce((acc, j) => acc + (m.labels[j] === want ? 1 : 0), 0);
}
