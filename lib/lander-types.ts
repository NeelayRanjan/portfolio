// Types for the Titan lander module (public/lander/v1/lander.js), copied from
// the handoff's lander.d.ts. The module is loaded by URL at run time and never
// bundled; these only describe what it exports. Re-copy at every new version.
/** 0 calm, 1 breezy, 2 strong, 3 beyond predicted (spec 4.5; see the copy notes). */
export type ConditionsLevel = 0 | 1 | 2 | 3;

export interface LanderOptions {
  /** URL of the directory holding lander.js, lander-worker.js, models/ and ort/, on this page's origin. */
  assetBase: string;
  /** No attract flight and no ghost traffic until the visitor starts a flight. Defaults to prefers-reduced-motion. */
  reducedMotion?: boolean;
  onEvent?: (e: LanderEvent) => void;
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
}
export declare function mount(container: HTMLElement, opts: LanderOptions): LanderHandle;
