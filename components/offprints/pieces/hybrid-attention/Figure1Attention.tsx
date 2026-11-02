"use client";

import { Fragment } from "react";
import type { hybridAttention } from "@/content/offprints/hybrid-attention";
import { Definition } from "@/components/offprints/Definition";
import { useUndo } from "@/components/offprints/useUndo";
import { trackDemoOnce } from "@/lib/track";
import { bestKey, pctOf, readoutParts, tintWidth, TEXT_FLIP } from "@/lib/offprints/figure1";

export type Figure1Data = {
  model: string;
  layer: number;
  extracted: string;
  sentence: { tokens: string[]; attention: number[][][] };
  defaultHead: number;
};

type Copy = {
  figure1: (typeof hybridAttention)["figure1"];
  definitions: (typeof hybridAttention)["definitions"];
};

const START = 13; // " it", the token the caption is about
const ROLES = ["q", "k", "v"] as const;
const BAR = { q: "bg-q", k: "bg-k", v: "bg-v" } as const;
const QUERY_BAR = 70; // fixed: the query is the asker's own, nothing to weigh
const VALUE_BAR = 55; // fixed: the value is what gets handed back

/**
 * Figure 1 of No. 1: one attention head of Qwen3.5-0.8B-Base (layer 7, head
 * data.defaultHead) reading the cat sentence, with the weights extracted from
 * the model (figure1.json, derived by scripts/offprints/derive-hybrid-
 * attention.mjs). Click a token to ask from it: every token it has already
 * seen is tinted by the weight it gets; the ones after it are faded, since a
 * causal head cannot look ahead. Every number on screen is read from the
 * json, never computed from a stand-in.
 */
export function Figure1Attention({ data, copy }: { data: Figure1Data; copy: Copy }) {
  const { tokens, attention } = data.sentence;
  const { value: sel, set, undo, canUndo } = useUndo(START);
  const row = attention[data.defaultHead][sel];
  const best = bestKey(row, sel);
  const word = (i: number) => tokens[i].trim();
  const f = copy.figure1;

  const pick = (i: number) => {
    trackDemoOnce("offprints/hybrid-attention/figure-1");
    if (i !== sel) set(i);
  };

  // The same fill as fillReadout, with the two words in their role colours.
  const readout = readoutParts(f.readout).map((p, i) => (
    <Fragment key={i}>
      {p === "{from}" ? (
        <span className="text-q">{word(sel)}</span>
      ) : p === "{to}" ? (
        <span className="text-k">{word(best)}</span>
      ) : p === "{pct}" ? (
        pctOf(row[best])
      ) : (
        p
      )}
    </Fragment>
  ));

  return (
    <div className="bg-paper">
      <div role="group" aria-label={f.label} className="flex flex-wrap justify-center gap-1.5">
        {tokens.map((t, j) => {
          const w = row[j];
          const asking = j === sel;
          const future = j > sel;
          const tinted = !asking && !future;
          return (
            <button
              key={j}
              type="button"
              data-op-chip
              aria-pressed={asking}
              onClick={() => pick(j)}
              title={future ? f.future : asking ? undefined : f.weight.replace("{w}", String(w))}
              className={`rounded-none border p-2 font-mono text-[16px] leading-none text-ink ${
                asking
                  ? "border-transparent bg-paper outline-2 outline-q outline-solid focus-visible:shadow-[0_0_0_4px_var(--color-paper),0_0_0_6px_var(--color-ink)]"
                  : "border-rule"
              } ${future ? "opacity-35" : ""}`}
              style={
                tinted
                  ? {
                      background: `color-mix(in oklab, var(--color-k) ${tintWidth(w)}%, var(--color-paper))`,
                      color: w > TEXT_FLIP ? "var(--color-paper)" : undefined,
                    }
                  : undefined
              }
            >
              {word(j)}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex h-[30px] items-center justify-end">
        {canUndo ? (
          <button type="button" data-op-undo className="op-tool" onClick={undo}>
            {f.undo}
          </button>
        ) : null}
      </div>

      <p data-op-readout aria-live="polite" className="mt-1 text-center text-[16px]">
        {readout}
      </p>

      <div className="mt-2 grid gap-3 *:my-0 min-[640px]:grid-cols-3">
        {copy.definitions.map((d, i) => {
          const role = ROLES[i];
          const pct = role === "q" ? QUERY_BAR : role === "k" ? Number(pctOf(row[best])) : VALUE_BAR;
          return (
            <Definition key={d.term} n={i + 1} term={d.term} symbol={d.symbol} role={role}>
              {d.text}
              <span aria-hidden className="mt-2.5 block h-[6px] bg-paper">
                <span className={`block h-full ${BAR[role]}`} style={{ width: `${pct}%` }} />
              </span>
            </Definition>
          );
        })}
      </div>
    </div>
  );
}

