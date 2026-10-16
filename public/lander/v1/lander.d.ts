// Public typings for dist/lander/lander.js (Titan rotorcraft, roadmap C12 plus site embedding v2).
// Load the module at runtime by URL; these types describe what it exports.
/** 0 calm, 1 breezy, 2 strong, 3 beyond predicted (spec 4.5; see the copy notes). */
export type ConditionsLevel = 0 | 1 | 2 | 3;

/** Canvas colours, as CSS colour strings. Every key is optional in LanderOptions.theme. */
export interface LanderTheme {
  sky: string; ground: string; terrain: string; text: string;
  /** The dream: predicted craft, ghosts, plan ghosts. */
  model: string;
  /** The no-model physics fallback and the simple pilot. */
  baseline: string;
  /** Targets, landing-zone marks, the inset's frame. */
  readout: string;
  craft: string; hazard: string;
}

/** Text drawn on the canvas. insetLabel may contain {s}; targetLabel may contain {label}. */
export interface LanderText {
  terrainCaption: string; awaitingTouchdown: string; insetLabel: string;
  targetLabel: string;
  simplePilot: string; noModel: string;
}

export type LanderFaultKind = 'weakRotor' | 'gustFront' | 'lidarDropout' | 'hazard';
export type LanderCommandName = 'newFlight' | 'setLevel' | 'setAutopilot' | 'setInput' | 'injectFault';

export interface LanderOptions {
  /** URL of the directory holding lander.js, lander-worker.js, models/ and ort/, on this page's origin. */
  assetBase: string;
  /** 'none': the canvas only; the host builds every control from onState and the handle's commands. Default 'full'. */
  ui?: 'full' | 'none';
  theme?: Partial<LanderTheme>;
  /** false: no text drawn on the canvas. */
  text?: Partial<LanderText> | false;
  /** The downlink inset; default true. */
  inset?: boolean;
  /** Canvas width / height; default 16 / 9. 'fill': 100% of a container with a definite height. */
  aspect?: number | 'fill';
  /** Tightens the camera: near the ground its visible width is divided by this, easing with altitude to keep the ground in view (never tighter than about 16 m). Read at mount. A finite number in [1, 4]; default 1. */
  zoom?: number;
  /** A shared ORT runtime directory on this origin, or one per entry ({ wasm, webgpu }); an omitted entry is bundled. A directory is used only when its files match ort/manifest.json's sha256. */
  ortBase?: string | { wasm?: string; webgpu?: string };
  /** The models directory on this origin; default `${assetBase}models/`. */
  modelsBase?: string;
  /** No attract flight and no ghost traffic until the visitor starts a flight. Defaults to prefers-reduced-motion. */
  reducedMotion?: boolean;
  onEvent?: (e: LanderEvent) => void;
  onState?: (s: LanderState) => void;
}
export type LanderEvent =
  | { type: 'flight_started'; mode: 'manual' | 'autopilot'; hop: number; level: ConditionsLevel }
  | { type: 'handover'; to: 'manual' | 'autopilot' }
  | { type: 'landed' | 'crashed'; hop: number; level: ConditionsLevel; mode: 'manual' | 'autopilot' }
  | { type: 'chain_finished'; landed: number };
export interface LanderHandle {
  pause(): void;
  resume(): void;
  unload(): Promise<void>;
  /** A visitor flight on the pad, waiting for the first input. hop defaults to 1 (a new chain); level sets the conditions first. */
  newFlight(o?: { hop?: 1 | 2 | 3 | 4 | 5; level?: ConditionsLevel }): void;
  /** The conditions for the next flight (the current one keeps its own). */
  setLevel(level: ConditionsLevel): void;
  /** A real handover in a visitor flight (emits 'handover'); on a waiting flight, true starts it in autopilot. A no-op while the model is not ready. */
  setAutopilot(on: boolean): void;
  /** The thrust vector, x and y each in [-1, 1]; ends attract and begins a waiting flight, like a key press. */
  setInput(v: { x: number; y: number }): void;
  injectFault(kind: LanderFaultKind): void;
}
export interface LanderState {
  mode: 'manual' | 'autopilot'; attract: boolean; hop: number; level: ConditionsLevel;
  model: 'loading' | 'ready' | 'absent';
  /** 'degraded': below the top budget rung. */
  planner: 'ok' | 'degraded' | 'simple-pilot';
  display: 'predicted' | 'fallback';
  /** What the visitor's instruments show: the display pose, never the onboard truth. energy is 0..1. */
  flight: { agl: number; vx: number; vy: number; tiltDeg: number; energy: number; windMs: number };
  landing: { pSafe: number; tGo: number } | null;
  outcome: null | 'landed' | 'crashed';
}
export declare function mount(container: HTMLElement, opts: LanderOptions): LanderHandle;
