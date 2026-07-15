/**
 * Loader for the chess EBM's interpretability data.
 *
 * WHY THIS MODEL AND NOT THE DIFFUSION ONES: the chess backbone is
 * full-resolution — it never downsamples below the 8x8 board until the last
 * layer, so every layer's activations stay registered to the squares and can be
 * laid straight onto them and read. The diffusion UNets downsample to 7x7/4x4,
 * so their mid-layers go spatially abstract. Don't try this there.
 *
 * The renderer takes 8x8 float arrays and does not care where they came from —
 * precomputed here, or a live forward pass later. Keep it that way.
 *
 * NO LIVE MODE YET: the shipped `chess-int8.onnx` exposes only ["energy","value"].
 * Live extraction needs a re-export that marks the intermediate layers as extra
 * outputs; the renderer is already source-agnostic, so that would be a new
 * loader and nothing else.
 */

/** Bump = breaking change to the file's shape. Refuse anything else. */
export const SUPPORTED_VERSION = 1;

export type ChannelMap = { ch: number; map: number[] };

export type ActivationPosition = {
  id: string;
  fen: string;
  label: string;
  energy: number;
  eval_white: number;
  /** 64 floats [0,1], row-major: which squares most move the evaluation. */
  saliency: number[];
  /** layer name -> 64 floats [0,1], mean activation magnitude. */
  activations: Record<string, number[]>;
  /** Optional per layer. Absent = no drill-down for that layer. */
  top_channels?: Record<string, ChannelMap[]>;
};

export type ActivationSet = {
  version: number;
  grid: number;
  /** Ordered shallow -> deep. READ THIS — never hardcode the layer count. */
  layers: string[];
  positions: ActivationPosition[];
  /** First-layer kernels, shared across positions. Optional. */
  filters?: number[][];
};

let cache: Promise<ActivationSet | null> | null = null;

/**
 * Fetches and validates the activation data.
 *
 * Resolves null when the file isn't there, which is what the UI gates the
 * activation toggle on. The data is pending "are the results good enough to
 * show" — until it lands there is nothing to display, and a fabricated heatmap
 * would teach the wrong thing about what the model sees.
 */
export function loadChessActivations(): Promise<ActivationSet | null> {
  if (cache) return cache;
  cache = (async () => {
    let raw: Record<string, unknown>;
    try {
      const res = await fetch("/chess_activations.json");
      if (!res.ok) return null;
      raw = await res.json();
    } catch {
      return null;
    }

    const version = Number(raw.version);
    if (version !== SUPPORTED_VERSION) {
      throw new Error(
        `chess_activations.json is version ${version}, this build understands ${SUPPORTED_VERSION}`,
      );
    }

    const grid = Number(raw.grid);
    const layers = raw.layers as string[];
    const positions = raw.positions as ActivationPosition[];
    if (!Array.isArray(layers) || !layers.length) {
      throw new Error("chess_activations.json: no layers");
    }
    if (!Array.isArray(positions) || !positions.length) {
      throw new Error("chess_activations.json: no positions");
    }
    // grid*grid must equal the heatmap length, or every map is misaligned by a
    // silent off-by-N and the overlay lands on the wrong squares.
    if (grid * grid !== positions[0].saliency?.length) {
      throw new Error(
        `chess_activations.json: grid ${grid}x${grid} != saliency length ${positions[0].saliency?.length}`,
      );
    }

    return { version, grid, layers, positions, filters: raw.filters as number[][] };
  })().catch((err) => {
    cache = null; // let a later mount retry rather than caching the failure
    throw err;
  });
  return cache;
}
