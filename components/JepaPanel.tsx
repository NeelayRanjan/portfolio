"use client";

import { useCallback, useEffect, useState } from "react";
import { InstrumentFigure } from "./manuscript/InstrumentFigure";
import { Note } from "./manuscript/Row";
import {
  loadJepaManifest,
  loadJepaSprites,
  purity,
  spriteCell,
  type Encoder,
  type JepaManifest,
} from "@/lib/jepa";
import { copy } from "@/content/copy";

const C = copy.lab.jepa;

/**
 * MAE vs I-JEPA: what two encoders retrieve for the same query.
 *
 * NOTHING RUNS HERE. Both encoders were pretrained offline; this renders their
 * exported neighbours and probe numbers.
 *
 * ⚠️ THERE WAS A SECOND TAB, "embeddings", AND IT IS GONE ON PURPOSE. It drew the
 * two UMAP fits as canvas scatters with a class highlighter. Don't rebuild it
 * without reading CLAUDE.md §7 first: the I-JEPA projection carries a visible
 * artifact (12 points collapsed into a 0.005-wide blob in one corner, class-mixed,
 * absent from the MAE fit), and a viewer reads that as something the encoder did
 * rather than something UMAP did. It also split attention away from retrieval,
 * which is the thing this section actually demonstrates. If it comes back, the
 * separate-fits honesty note comes back with it.
 *
 * ⚠️ NEITHER ENCODER IS COLOUR-CODED, AND THAT IS DELIBERATE. The obvious move is
 * MAE / I-JEPA in the two accent colours. It cannot work here: red is already
 * this figure's one load-bearing signal ("this neighbour's class differs from the
 * query's"). Tinting one encoder's whole block would put a second colour claim on
 * the block that fails most often, and it would read as branding rather than a
 * result. Encoders are told apart by their labels; colour is reserved for what
 * the data says. (The numeric metrics further down get the same equal
 * treatment for the same reason — both encoders' numbers are plain ink.)
 *
 * The query IS live, but its control is clicking a thumbnail, not a text box —
 * `--compare mae,ijepa` and `--dataset stl10` were always frozen, since the
 * bundle holds exactly one dataset and exactly two encoders.
 */

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/* ---- shared thumbnail ---------------------------------------------------- */

/**
 * One image from the atlas.
 *
 * A `<button>` when it sets the query, so every clickable thumbnail is reachable
 * and pressable without a mouse. **A plain `role="img"` when it doesn't** — the
 * big query image at the top is the one thumbnail on the panel that is an answer
 * rather than a control, and rendering it as a button would put a focus stop in
 * the tab order that swallows a keypress and does nothing.
 *
 * `bg-*` utilities are avoided on purpose: the sprite window is inline style
 * because it is computed per index (see spriteCell).
 */
function Thumb({
  m,
  index,
  onPick,
  className = "",
  ariaLabel,
  differs = false,
}: {
  m: JepaManifest;
  index: number;
  onPick?: (i: number) => void;
  className?: string;
  ariaLabel: string;
  /** Class differs from the query's. Marked, never veiled — see below. */
  differs?: boolean;
}) {
  const style = spriteCell(m, index);
  /**
   * ⚠️ RED IS THE SITE'S ONE RESERVED THIRD COLOUR AND IT IS DELIBERATE
   * (`--color-red-ink`). It means exactly one thing on this page: a neighbour
   * whose class differs from the query's.
   *
   * ⚠️ AN OUTLINE, NOT AN OPACITY VEIL. Dimming wrong-class neighbours was tried
   * and reverted: a 0/8 block is eight dimmed photos, and the whole finding lives
   * in actually LOOKING at them and noticing they are all red. Fading the
   * evidence to mark it as evidence hides the thing the block exists to show.
   *
   * ⚠️ `border-2` ON BOTH STATES, colour is the only difference. A 1px correct
   * border against a 2px wrong one would shift every cell in the grid by a pixel
   * depending on the data, which reads as the layout being broken.
   *
   * There was also a filled corner chip carrying the cross onto the thumbnail.
   * Removed by request: with red doing the work the border is loud enough, and
   * the chip was the one element that sat on top of the evidence. The cross
   * survives in the caption, which is what keeps the mark legible to anyone who
   * cannot separate the hues.
   */
  const border = differs ? "border-red-ink" : "border-rule";
  const box = `block w-full overflow-hidden border-2 ${border} ${className}`;
  const inner = <span aria-hidden="true" className="block aspect-square w-full" style={style} />;

  if (!onPick) {
    return (
      <div role="img" aria-label={ariaLabel} className={box}>
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onPick(index)}
      aria-label={ariaLabel}
      /**
       * ⚠️ HOVER IS A RING, NOT A BORDER COLOUR, and this was a real bug caught in
       * the browser. It used to override the border colour directly, which turned
       * a failed neighbour's border ok on hover and made it look like a hit, on
       * the one control whose entire job is saying it missed. The border carries
       * data here, so it can't also carry pointer feedback. A ring is a
       * box-shadow: it sits outside the border, costs no layout, and leaves the
       * state colour alone.
       */
      className={`${box} transition-shadow hover:ring-2 hover:ring-ok`}
    >
      {inner}
    </button>
  );
}

/* ---- the retrieval view -------------------------------------------------- */

/**
 * One encoder's answer to the query, as a 4x2 block.
 *
 * ⚠️ THE TWO BLOCKS SIT SIDE BY SIDE, NOT STACKED, and the shape is the argument.
 * Stacked full-width rows put the comparison on a vertical scan; adjacent blocks
 * put it in one glance, which is what this section is trading on — MAE's eight
 * are red things, I-JEPA's eight are ships, and you see that before you have read
 * a single class label. The 4-wide grid is what makes each half a block rather
 * than a strip.
 *
 * Thumbnail size is unchanged by the switch: a half-panel at 4 across is the same
 * width per cell as a full panel at 8 across.
 */
function NeighborBlock({
  m,
  encoder,
  query,
  onPick,
  name,
  target,
}: {
  m: JepaManifest;
  encoder: Encoder;
  query: number;
  onPick: (i: number) => void;
  name: string;
  target: string;
}) {
  const ids = m.neighbors[encoder][query];
  const want = m.labels[query];
  const hits = purity(m, encoder, query);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 font-mono text-[11px]">
        <span className="text-ink">{name}</span>
        <span className="text-mut/60">{target}</span>
        {/* The readout the whole block exists to produce. */}
        <span className="ml-auto text-mut">
          {hits}/{m.k}
          {C.samePost}
        </span>
      </div>
      {/* Always 4 across. On desktop that is half the panel; on a phone the
          blocks stack and it is the full width. Eight across on a phone would be
          a 33px photo, too small to tell a deer from a horse, which is the exact
          judgement being asked for. */}
      <div className="grid grid-cols-4 gap-2">
        {ids.map((j) => {
          const differs = m.labels[j] !== want;
          return (
            <figure key={j} className="min-w-0">
              <Thumb
                m={m}
                index={j}
                onPick={onPick}
                differs={differs}
                // ⚠️ The red outline is NOT the only carrier of "wrong class".
                // Same rule as the draw panel's fit tint: colour alone puts the
                // finding behind seeing it.
                ariaLabel={`${m.classes[m.labels[j]]}${differs ? C.ariaDiffers : C.ariaSame}${C.ariaSetQuery}`}
              />
              <figcaption
                className={`mt-1 truncate font-mono text-[10px] ${
                  differs ? "text-red-ink" : "text-mut"
                }`}
              >
                {/* The cross, so the mismatch survives being read as text and not
                    only seen as a colour — red against neutral grey is weak under
                    the common red-green deficiencies, and this is the carrier that
                    doesn't care. aria-hidden because the button's own label
                    already says "different class". */}
                {differs ? <span aria-hidden="true">{C.differsMark} </span> : null}
                {m.classes[m.labels[j]]}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

function Retrieval({
  m,
  query,
  onPick,
}: {
  m: JepaManifest;
  query: number;
  onPick: (i: number) => void;
}) {
  const random = useCallback(() => {
    onPick(Math.floor(Math.random() * m.n));
  }, [m.n, onPick]);

  return (
    <div>
      {/* The question, centred and larger than anything under it. The size order
          is deliberate and carries the hierarchy on its own: query 144px, each
          neighbour ~110px, each preset ~84px. */}
      <figure className="flex flex-col items-center">
        <div className="w-36">
          <Thumb
            m={m}
            index={query}
            ariaLabel={`${C.ariaQueryPre}${m.classes[m.labels[query]]}`}
          />
        </div>
        <figcaption className="mt-2 font-mono text-[11px]">
          <span className="text-mut/60">{C.queryLabel}</span>{" "}
          <span className="text-ink">{m.classes[m.labels[query]]}</span>
        </figcaption>
      </figure>

      {/* The pinned queries. Picked by purity gap in the exporter, not by eye, so
          they are the honest "this is what the effect looks like" set rather than
          a curated highlight reel. Held to max-w-2xl so they stay smaller than
          the results: full-panel width would make a preset the same size as a
          neighbour and the two would compete. */}
      <div className="mx-auto mt-8 max-w-2xl">
        <div className="mb-2 flex items-baseline gap-2 font-mono text-[11px]">
          <span className="text-mut/60">{C.presetsLabel}</span>
          <button
            type="button"
            onClick={random}
            className="ml-auto border border-rule px-3 py-1.5 font-mono text-xs text-mut transition-colors hover:border-mut hover:text-ink"
          >
            {C.random}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {m.seedQueries.map((i) => (
            <Thumb
              key={i}
              m={m}
              index={i}
              onPick={onPick}
              className={i === query ? "!border-ok" : ""}
              ariaLabel={`${m.classes[m.labels[i]]}${C.ariaSetQuery}`}
            />
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] text-mut/60">{C.queryCaption}</p>
      </div>

      {/* The two answers, adjacent. See NeighborBlock for why this is not two
          stacked rows. Stacks on a phone, where there is no second column. */}
      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-6">
        <NeighborBlock
          m={m}
          encoder="mae"
          query={query}
          onPick={onPick}
          name={C.maeName}
          target={C.maeTarget}
        />
        <NeighborBlock
          m={m}
          encoder="jepa"
          query={query}
          onPick={onPick}
          name={C.jepaName}
          target={C.jepaTarget}
        />
      </div>

      {m.meanPurity ? (
        <p className="mt-6 font-mono text-[11px] text-mut/60">
          {C.meanPurityPre}
          {m.n.toLocaleString("en-US")}
          {C.meanPurityMid}
          {/* Equal treatment for both numbers — see the file header on why
              neither encoder gets its own accent colour. */}
          <span className="text-ink">{pct(m.meanPurity.mae)}</span>
          {C.meanPurityMid2}
          <span className="text-ink">{pct(m.meanPurity.jepa)}</span>
          {C.meanPurityPost}
        </p>
      ) : null}

      {/* 🔒 HONESTY NOTE. There were two. The other one said the two UMAP maps
          were separate fits, and it went when the scatter tab did — a caveat
          about panels that are no longer on the page is noise. ⚠️ It has to come
          back with the tab. */}
      <div className="mt-4 max-w-xl">
        <Note tag="note">
          {C.neighborNotePre}
          {m.k}
          {C.neighborNotePost}
        </Note>
      </div>
    </div>
  );
}

/* ---- the figure ------------------------------------------------------------ */

export function JepaSection() {
  const [m, setM] = useState<JepaManifest | null>(null);
  /** True once we know an artifact is missing. Drops the whole figure. */
  const [gated, setGated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<number | null>(null);

  /**
   * Lazy, and this component is mounted on scroll-in by `DeferredMount` (app/lab),
   * so a plain mount-only effect is the deferral — no boot gate needed here.
   * ~4.1 MB sits behind this (a 483 KB manifest and a 3.6 MB atlas), so it must
   * not be in flight before the figure is reached.
   *
   * Deliberately NOT added to lib/warm.ts's preload window. That window is spent
   * on onnxruntime-web, which two demos share and which costs 24 MB; adding 4 MB
   * of atlas to the same idle callback would compete with it for a figure several
   * screens further down.
   */
  useEffect(() => {
    let alive = true;
    loadJepaManifest()
      .then(async (manifest) => {
        if (!alive) return;
        if (!manifest) return setGated(true);
        // The atlas gates too: neighbour rows of empty squares would be a worse
        // lie than no figure, since the demo IS the pictures.
        const img = await loadJepaSprites(manifest.spriteUrl);
        if (!alive) return;
        if (!img) return setGated(true);
        setM(manifest);
        setQuery(manifest.seedQueries[0] ?? 0);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const pick = useCallback((i: number) => setQuery(i), []);

  // Artifacts absent: no figure at all, no heading, no placeholder. This is why
  // the component returns null around its own InstrumentFigure instead of
  // page.tsx wrapping one — otherwise the heading would survive its own panel.
  if (gated) return null;

  const ready = m !== null && query !== null;

  return (
    <>
      <InstrumentFigure
        n="S2"
      id="jepa"
      caption={C.figureCaption}
      readout={ready ? `${m.n.toLocaleString("en-US")} images · ${m.dataset} ${m.split}` : C.statusLoading}
    >
      {/* pr-52 keeps the heading clear of the figure's absolutely-positioned
          readout, which runs to ~"4,096 images · stl10 test" at its longest. */}
      <h2 className="mt-1 mb-2 pr-52 text-[22px] font-semibold text-ink">{C.heading}</h2>
      {/* Sans prose, the site's explanatory register: this paragraph explains,
          so it is serif; every label, readout and caveat below is the machine
          talking, so it stays mono. */}
      <p className="mb-4 max-w-2xl text-[15px] leading-relaxed text-mut">{C.lede.a}</p>
      {/* Paragraph two, assembled from three pieces: `b` opens it, the
          manifest's numbers land mid-sentence. It's gated on `m` because the
          numbers are: during the short load there is nothing on screen for it
          to qualify. */}
      {m ? (
        <>
          <p className="mb-6 max-w-2xl text-[15px] leading-relaxed text-mut">
            {C.lede.b}
            {C.lede.cPre}
            <span className="text-ink">{pct(m.metrics.mae.linear_probe)}</span>
            {C.lede.cMid1}
            <span className="text-ink">{pct(m.metrics.jepa.linear_probe)}</span>
            {C.lede.cMid2}
            <span className="text-ink">{pct(m.metrics.mae.knn)}</span>
            {C.lede.cMid3}
            <span className="text-ink">{pct(m.metrics.jepa.knn)}</span>
            {C.lede.cPost}
          </p>
          {/* `scope` bounds a claim, so it must not appear before the claim
              does — gated on `m` along with the numbers above it. */}
          <div className="mb-6 max-w-2xl">
            <Note tag="scope">{C.scope}</Note>
          </div>
        </>
      ) : null}

      {error ? (
        <p className="py-16 text-center font-mono text-xs text-red-ink">
          {C.errorPrefix}
          {error}
        </p>
      ) : !ready ? (
        <p className="py-16 text-center font-mono text-xs text-mut/60">{C.statusLoading}</p>
      ) : (
        <Retrieval m={m} query={query} onPick={pick} />
      )}
      </InstrumentFigure>
    </>
  );
}
