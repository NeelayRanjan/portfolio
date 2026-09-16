"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { subscribeStargaze } from "@/lib/stargaze";
import { SkyCard, type CardModel } from "./SkyCard";
import { createCardController } from "./night-sky/card-controller";
import { createFrameLoop } from "./night-sky/frame-loop";
import { SkyKeyboardList, createKeyboardList, useListSlot, type ListActions, type ListItem } from "./night-sky/keyboard-list";
import { loadSkyLayers } from "./night-sky/layer-loaders";
import { createPainter } from "./night-sky/painter";
import { createPointerController } from "./night-sky/pointer-controller";
import { createSkyState } from "./night-sky/state";

/**
 * NightSky: the real sky over NASA Ames behind every page, replacing v2's
 * DeskField particles (spec: docs/superpowers/specs/2026-09-14-night-sky-design.md).
 *
 * Budgets, all load-bearing:
 * - One clock: the load instant, then SKY_SPEEDUP (180x). Angles come from
 *   it, never from frame counts (the Constitution's dt rule).
 * - ~20 fps at >=880px, ~10 fps below; frames skipped while document.hidden;
 *   DPR capped at 2 so stars stay crisp without a 3x backing store.
 * - Reduced motion: the real sky at the load instant, painted on change only.
 * - The catalog (~55 KB) is fetched after first paint; until it lands, or if
 *   it never does, the desk is plain dark. Nothing stands in for it.
 * - Phones get it too (owner call, 2026-09-14) with a mag 4.5 cut.
 * - Drag to pan (spec 2026-09-15 §3): mouse or pen on the desk in normal
 *   mode, any pointer anywhere while stargazing; a critically damped spring
 *   (lib/sky-pan.ts) brings the chart home on release, and the frame gate is
 *   lifted while a drag or the spring is live so the motion stays smooth.
 *   Reduced motion snaps home instead. The sky keeps turning throughout.
 *
 * - The objects layers (spec 2026-09-15 §4, §9): objects.json and
 *   milkyway.json are fetched after first paint alongside sky.json, each
 *   gated on its own (absent: the sky draws without it; malformed: logged).
 *   The one-liners come from content/sky-facts.ts, a lazy chunk, so first
 *   paint never carries ~138 entries of prose.
 *
 * - Cards (spec 2026-09-15 §6): in stargaze mode a click (under
 *   CLICK_SLOP_PX of travel) on a selectable's symbol or drawn name opens
 *   its SkyCard, a click on empty sky closes it, Escape closes it before it
 *   can reach StargazeToggle's exit. The card follows its subject as the sky
 *   turns and while dragging. When the subject leaves the viewport the card
 *   stays open where it was and says so; only the visitor closes a card
 *   (final review F3).
 *
 * - Keyboard and screen readers (final review F2): the canvas is
 *   aria-hidden, so in stargaze mode a visually hidden list of buttons, one
 *   per selectable currently on screen, is portalled into StargazeToggle's
 *   slot right after the exit control. It refreshes every LIST_REFRESH_MS,
 *   and only re-renders when the set changes; a focused button rings its
 *   subject on the canvas through the hover highlight.
 *
 * - The ISS (spec 2026-09-15 §8): a TLE from the same-origin /api/iss-tle,
 *   propagated by satellite.js (lazy-imported only once there is a TLE) at
 *   the simulated time, precessed into the chart's J2000 frame.
 *
 * Layout (the 2026-09-16 split, no behaviour change): this component only
 * orchestrates. The modules under ./night-sky/ share one mutable SkyState
 * (state.ts) the way the old single effect shared its closure:
 * - painter.ts: canvas sizing, the font, the paint and `window.__sky`.
 * - frame-loop.ts: the rAF loop, its frame gates and the return spring.
 * - card-controller.ts: card models, open/close, placement, Escape.
 * - keyboard-list.tsx: the stargaze keyboard list and its portal.
 * - pointer-controller.ts: hover, drag to pan, the stargaze click.
 * - layer-loaders.ts: every fetch behind the sky.
 *
 * `window.__sky` is a read-only snapshot for scripts/verify-redesign.mjs.
 */

export function NightSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  /** The effect's own paint, so a freshly committed card gets placed before the browser paints it. */
  const repaintRef = useRef<() => void>(() => {});
  const closeRef = useRef<() => void>(() => {});
  /** Re-reads the open card's offsetWidth/offsetHeight into the effect's
   *  cached size (fix round 1, promoted minor): called on open, on window
   *  resize, and from the card's own ResizeObserver below, so followCard
   *  never forces a layout read at ~20fps. */
  const updateCardSizeRef = useRef<() => void>(() => {});
  /** False for a close that's part of leaving stargaze entirely (fix round
   *  1, I3): StargazeToggle already returns focus to its own entry button
   *  in that case, so NightSky must not also grab it for the exit control. */
  const focusRestoreRef = useRef(true);
  const prevCardRef = useRef<CardModel | null>(null);
  /** The keyboard-list button that opened the open card, if one did: focus
   *  goes back there on close, so a keyboard user keeps their place (F2). */
  const openerRef = useRef<HTMLElement | null>(null);
  const listActionsRef = useRef<ListActions | null>(null);
  const [card, setCard] = useState<CardModel | null>(null);
  const [cardOutOfView, setCardOutOfView] = useState(false);
  const [listItems, setListItems] = useState<ListItem[]>([]);

  useLayoutEffect(() => {
    if (card) {
      updateCardSizeRef.current();
      repaintRef.current();
      cardRef.current?.focus({ preventScroll: true });
      prevCardRef.current = card;
      const el = cardRef.current;
      if (!el || typeof ResizeObserver === "undefined") return;
      // The card's own size can change after it opens (a shower's four data
      // lines vs. a star's none, or a width crossing 880px) without `card`
      // itself changing, which is why this can't just run once on open.
      const ro = new ResizeObserver(() => {
        updateCardSizeRef.current();
        repaintRef.current();
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
    if (prevCardRef.current && focusRestoreRef.current) {
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>("[data-stargaze-exit]")?.focus({ preventScroll: true });
    }
    openerRef.current = null;
    prevCardRef.current = null;
    // Fix round 1, I1: keyed on the SUBJECT (card?.id), not the card object
    // itself. The ISS card's once-a-second refresh (the painter) calls setCard
    // with a freshly built model whose altitude/speed/epoch text changed but
    // whose id didn't; keying on the object would re-run this effect every
    // second, stealing focus back from wherever the visitor had tabbed to
    // (a citation link, the close button) and making a screen reader
    // re-announce the card. Keying on id alone still fires exactly when a
    // card opens, changes subject, or closes.
  }, [card?.id]);

  const listSlot = useListSlot();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const s = createSkyState();

    // The modules call each other at event time, never during setup, so the
    // thunks below only ever run once every module exists.
    const cards = createCardController(s, {
      cardRef,
      openerRef,
      focusRestoreRef,
      setCard,
      setCardOutOfView,
      paint: () => paint(),
    });
    updateCardSizeRef.current = cards.updateCardSize;
    closeRef.current = cards.closeCard;
    const painter = createPainter(s, canvas, ctx, {
      followCard: cards.followCard,
      buildCard: cards.buildCard,
      setCard,
      isOutOfView: cards.isOutOfView,
    });
    const { paint, resize, resolveFont } = painter;
    const pointer = createPointerController(s, { cards, paint });
    const list = createKeyboardList(s, {
      cards,
      setHighlight: pointer.setHighlight,
      setCard,
      setListItems,
      openerRef,
      paint,
    });
    listActionsRef.current = list.actions;
    const loop = createFrameLoop(s, paint);

    const onResize = () => {
      resize();
      cards.updateCardSize();
      paint();
    };

    resize();
    resolveFont();
    paint();
    loop.applyMode();

    loadSkyLayers(s, { paint, resolveFont });

    window.addEventListener("resize", onResize);
    s.reducedQ.addEventListener("change", loop.applyMode);
    pointer.attach();
    window.addEventListener("keydown", cards.onKeyDown, { capture: true });
    const unsubStargaze = subscribeStargaze((on) => {
      s.highlight = null;
      // Leaving stargaze closes any open card too, but focus is
      // StargazeToggle's job here (it returns focus to its own entry
      // button), not the exit control NightSky would otherwise reach for.
      if (!on) {
        cards.closeCard({ restoreFocus: false });
        pointer.endHeldDragForExit();
        // The one place the page always gets its composed offset back,
        // however stargaze was left: the exit button, Escape, or anything
        // else, all of which funnel through setStargazing(false).
        pointer.settleOffset();
      }
      paint();
      if (on) list.startList();
      else list.stopList();
    });
    repaintRef.current = () => {
      if (!s.running) paint();
      else if (s.projected) cards.followCard(s.projected);
    };

    return () => {
      s.alive = false;
      loop.stop();
      window.removeEventListener("resize", onResize);
      s.reducedQ.removeEventListener("change", loop.applyMode);
      window.removeEventListener("keydown", cards.onKeyDown, { capture: true });
      pointer.detach();
      list.dispose();
      unsubStargaze();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      />
      {card ? (
        <SkyCard model={card} outOfView={cardOutOfView} cardRef={cardRef} onClose={() => closeRef.current()} />
      ) : null}
      <SkyKeyboardList slot={listSlot} items={listItems} actionsRef={listActionsRef} />
    </>
  );
}
