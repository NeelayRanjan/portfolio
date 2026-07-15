"use client";

import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import { ChessBoard } from "./ChessBoard";
import type { ActivationSet } from "@/lib/chess-activations";

/**
 * The interpretability view: the model's internals painted back onto the squares.
 *
 * Rides on the same board as the game — this is a mode, not a second board.
 *
 * The curated scenarios ARE the feature. They're the guaranteed-good teaching
 * moments, each with a label written by whoever generated the export and asserted
 * against python-chess (the fork really forks a queen and rook, Ra8 really is
 * mate). Lead with them; don't bury them behind ids.
 */
type Mode = "saliency" | "activation";

/** Whose move it is, in words, so the board isn't ambiguous when it's Black's. */
function toMoveLabel(fen: string): string {
  return new Chess(fen).turn() === "w" ? "white to move" : "black to move";
}

export function ChessActivations({ data }: { data: ActivationSet }) {
  const [posIndex, setPosIndex] = useState(1); // fork_f7: the best first impression
  const [mode, setMode] = useState<Mode>("saliency");
  // Deepest layer by default: that's where the "it concentrates on what decides
  // the eval" story actually lands.
  const [layerIndex, setLayerIndex] = useState(data.layers.length - 1);
  const [channel, setChannel] = useState<number | null>(null);

  const position = data.positions[Math.min(posIndex, data.positions.length - 1)];
  const layer = data.layers[layerIndex];
  const channels = position.top_channels?.[layer] ?? [];

  const overlay = useMemo(() => {
    if (mode === "saliency") {
      return { values: position.saliency, tint: "saliency" as const };
    }
    if (channel !== null) {
      const found = channels.find((c) => c.ch === channel);
      if (found) return { values: found.map, tint: "activation" as const };
    }
    return { values: position.activations[layer] ?? [], tint: "activation" as const };
  }, [mode, position, layer, channel, channels]);

  /** The squares the map is hottest on, named. The whole claim of the section is
   *  that these are the squares a human would name too, so say them out loud. */
  const hottest = useMemo(() => {
    const files = "abcdefgh";
    return overlay.values
      .map((v, i) => ({ v, sq: files[i % 8] + (8 - Math.floor(i / 8)) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 4)
      .filter((x) => x.v > 0.25)
      .map((x) => x.sq);
  }, [overlay]);

  const pick = (i: number) => {
    setPosIndex(i);
    setChannel(null); // channel ids are per position; carrying one over is meaningless
  };

  return (
    <div>
      <div className="flex flex-wrap items-start gap-8">
        <div>
          <ChessBoard fen={position.fen} overlay={overlay} />
          <p className="mt-3 w-[296px] font-mono text-[11px] leading-relaxed text-faint">
            <span className={mode === "saliency" ? "text-indigo" : "text-teal"}>
              {mode === "saliency" ? "energy attribution" : `activation · ${layer}`}
              {mode === "activation" && channel !== null ? ` · ch ${channel}` : ""}
            </span>
            {" · "}
            {toMoveLabel(position.fen)}
          </p>
          {hottest.length ? (
            <p className="mt-2 w-[296px] font-mono text-[11px] leading-relaxed text-faint">
              hottest: <span className="text-ink">{hottest.join(" ")}</span>
            </p>
          ) : null}
        </div>

        <div className="min-w-[240px] flex-1">
          <div className="mb-5 flex flex-wrap gap-2">
            {(["saliency", "activation"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setChannel(null);
                }}
                aria-pressed={m === mode}
                className={`rounded border px-3 py-1.5 font-mono text-xs transition-colors ${
                  m === mode
                    ? "border-indigo text-indigo"
                    : "border-line text-muted hover:border-faint hover:text-ink"
                }`}
              >
                {m === "saliency" ? "energy attribution" : "layer activation"}
              </button>
            ))}
          </div>

          {mode === "activation" ? (
            <div className="mb-5">
              {/* Driven by data.layers, never a hardcoded count. */}
              <label className="font-mono text-xs text-faint" htmlFor="depth">
                depth · {layer} ({layerIndex + 1}/{data.layers.length})
              </label>
              <input
                id="depth"
                type="range"
                min={0}
                max={data.layers.length - 1}
                value={layerIndex}
                onChange={(e) => {
                  setLayerIndex(Number(e.target.value));
                  setChannel(null);
                }}
                className="mt-2 w-full accent-teal"
              />
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-faint">
                shallow to deep. Early layers are local and edge-like; deep layers
                concentrate onto the squares that decide the eval, and it all stays
                board-aligned the whole way.
              </p>

              {channels.length ? (
                <div className="mt-4">
                  <span className="font-mono text-xs text-faint">top channels</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => setChannel(null)}
                      aria-pressed={channel === null}
                      className={`rounded border px-2 py-1 font-mono text-[11px] transition-colors ${
                        channel === null
                          ? "border-teal text-teal"
                          : "border-line text-muted hover:border-faint hover:text-ink"
                      }`}
                    >
                      mean
                    </button>
                    {channels.map((c) => (
                      <button
                        key={c.ch}
                        onClick={() => setChannel(c.ch)}
                        aria-pressed={channel === c.ch}
                        className={`rounded border px-2 py-1 font-mono text-[11px] transition-colors ${
                          channel === c.ch
                            ? "border-teal text-teal"
                            : "border-line text-muted hover:border-faint hover:text-ink"
                        }`}
                      >
                        {c.ch}
                      </button>
                    ))}
                  </div>
                  {/* Being straight about this reads as competence, not weakness. */}
                  <p className="mt-2 max-w-sm font-mono text-[11px] leading-relaxed text-faint">
                    Explore at your own risk: not every channel is human-interpretable.
                    Plenty light up on nothing nameable. The mean map and the
                    attribution view are the trustworthy ones.
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mb-5 max-w-sm font-mono text-[11px] leading-relaxed text-faint">
              The model outputs a single scalar energy. The gradient of that energy with
              respect to the board says which squares most move its evaluation: the
              hanging piece, the key defender, the passed pawn.
            </p>
          )}

          {/* eval_white ONLY. `energy` is in the data, but it is sibling-relative —
              meaningful only against the other candidate moves from one parent, and
              nonsense across positions. eval_white is the value head, comparable
              across positions, already sign-flipped to White. */}
          <p className="font-mono text-[11px] leading-relaxed text-faint">
            value head: {position.eval_white > 0 ? "+" : ""}
            {position.eval_white.toFixed(2)} for white
            {Math.abs(position.eval_white) < 0.15 ? " · about level" : ""}
          </p>
        </div>
      </div>

      {/* The scenarios, given the room they deserve: the label is the teaching
          moment, not the id. */}
      <div className="mt-8">
        <span className="font-mono text-xs text-faint">scenarios</span>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {data.positions.map((p, i) => {
            const active = p.id === position.id;
            return (
              <button
                key={p.id}
                onClick={() => pick(i)}
                aria-pressed={active}
                className={`rounded border px-3 py-2.5 text-left transition-colors ${
                  active
                    ? "border-teal bg-panel-bar"
                    : "border-line hover:border-faint"
                }`}
              >
                <span
                  className={`font-mono text-[11px] ${active ? "text-teal" : "text-muted"}`}
                >
                  {p.id}
                </span>
                <span className="mt-1 block text-[13px] leading-snug text-muted">
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
