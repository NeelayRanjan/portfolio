"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import {
  PEEL,
  clipPolygon,
  cutFromPointer,
  easeOutCubic,
  farCorner,
  flapPath,
  releaseTarget,
  shadowBlur,
  shadowOffset,
} from "@/lib/offprints/peel";

/**
 * The dog-ear peel's behaviour (spec §6, §10.4), for Shell.tsx. All the
 * geometry comes from lib/offprints/peel.ts; this file owns the state
 * machine, the pointer, the history entry and the per-frame DOM writes.
 *
 * `cut` (the fold's distance from the corner) lives on a mutable object and
 * is written straight to the DOM every frame (the index's clip-path, the
 * flap, the shadow, the crease), never through React state. React state
 * holds only the booleans the markup renders from: `open` (the index fully
 * exposed, cut at or past the far corner), `expanded` (the reader's intent,
 * aria-expanded), `dragging`, `hovering` and `hintFired`.
 */

type Press = { id: number; x: number; y: number; drag: boolean };

/** The flat page: everything but the uncovered triangle, even-odd. */
export function flatPagePath(c: number): string {
  return `M -100000 -100000 H 100000 V 100000 H -100000 Z M 0 0 L ${c} 0 L 0 ${c} Z`;
}

/** The ear's hit area: the 72px corner triangle. */
const EAR_PX = 72;
const inEar = (x: number, y: number) => x >= 0 && y >= 0 && x + y <= EAR_PX;
const far = () => farCorner(window.innerWidth, window.innerHeight);

export function usePeel(currentSlug?: string) {
  const earRef = useRef<HTMLAnchorElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const flatRef = useRef<SVGPathElement>(null);
  const shadowRef = useRef<SVGPathElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);
  const gradRef = useRef<SVGLinearGradientElement>(null);
  const flapRef = useRef<SVGPathElement>(null);
  const creaseRef = useRef<SVGLineElement>(null);

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [hintFired, setHintFired] = useState(false);

  // One mutable object for everything the handlers share, so the handlers
  // never go stale between renders.
  const s = useRef({
    cut: PEEL.rest as number,
    open: false,
    expanded: false,
    dragging: false,
    hovering: false,
    hintFired: false,
    touched: false, // pressed or hovered: the hint is skipped
    pushed: false, // the history entry on top is ours
    // This mount's history marker. Next preserves custom history state
    // across a reload and a traversal, so a bare `opIndex: true` left by an
    // earlier load would read as ours; only this token does.
    token: "",
    raf: 0,
    press: null as Press | null,
    suppressClick: false,
    focusPiece: false, // the open piece was chosen from the index
    reduced: false,
    canHover: false,
  }).current;

  // The handlers below are created once (the first render's closures) and
  // stored here, so listeners added in effects and the props on the ear are
  // the same functions throughout.
  const api = useRef<ReturnType<typeof makeApi> | null>(null);

  function makeApi() {
    const isOurs = (state: unknown) =>
      s.token !== "" && (state as { opIndex?: unknown } | null)?.opIndex === s.token;

    const apply = (c: number) => {
      s.cut = c;
      const nav = navRef.current;
      if (nav) nav.style.clipPath = clipPolygon(c);
      const d = flapPath(c);
      flapRef.current?.setAttribute("d", d);
      const sh = shadowRef.current;
      if (sh) {
        sh.setAttribute("d", d);
        const o = shadowOffset(c);
        sh.setAttribute("transform", `translate(${o} ${o})`);
      }
      blurRef.current?.setAttribute("stdDeviation", String(shadowBlur(c)));
      flatRef.current?.setAttribute("d", flatPagePath(c));
      const g = gradRef.current;
      if (g) {
        g.setAttribute("x1", String(c / 2));
        g.setAttribute("y1", String(c / 2));
        g.setAttribute("x2", String(0.96 * c));
        g.setAttribute("y2", String(0.96 * c));
      }
      const cr = creaseRef.current;
      if (cr) {
        cr.setAttribute("x1", String(c));
        cr.setAttribute("y2", String(c));
      }
      // Only an open the reader asked for counts: a drag past the far corner
      // stays a peek (index inert, piece visible) until its release.
      const full = s.expanded && c >= far();
      if (full !== s.open) {
        s.open = full;
        setOpen(full);
      }
    };

    const animateTo = (to: number, ms?: number, done?: () => void) => {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      const from = s.cut;
      if (s.reduced || from === to) {
        apply(to);
        done?.();
        return;
      }
      // The full rest-to-far-corner trip takes openMs; shorter trips take
      // their share of it, never under a quarter.
      const dur =
        ms ?? PEEL.openMs * Math.min(1, Math.max(0.25, Math.abs(to - from) / (far() - PEEL.rest)));
      const t0 = performance.now();
      const step = (now: number) => {
        const u = Math.min(1, (now - t0) / dur);
        if (u >= 1) {
          s.raf = 0;
          apply(to);
          done?.();
          return;
        }
        apply(from + (to - from) * easeOutCubic(u));
        s.raf = requestAnimationFrame(step);
      };
      s.raf = requestAnimationFrame(step);
    };

    const restValue = () => (s.hovering ? PEEL.hover : PEEL.rest);

    const setExp = (v: boolean) => {
      s.expanded = v;
      setExpanded(v);
    };

    const openIndex = (push = true) => {
      if (!s.expanded) setExp(true);
      if (push && !s.pushed) {
        // Same URL: the entry exists so a phone's Back closes the index.
        history.pushState({ opIndex: s.token }, "");
        s.pushed = true;
      }
      // The window may have grown while the fold travelled.
      animateTo(far(), undefined, () => {
        if (s.expanded && s.cut < far()) apply(far());
      });
    };

    const closeIndex = ({ fromPop = false, focus = "ear" as "ear" | "piece" } = {}) => {
      if (!s.expanded) {
        animateTo(restValue());
        return;
      }
      setExp(false);
      // Take our entry back off the stack, so the URL never changes and Back
      // from a fresh load still leaves the site.
      if (!fromPop && s.pushed && isOurs(history.state)) history.back();
      s.pushed = false;
      // The piece is still visibility: hidden here, so it takes focus in the
      // commit that shows it again (the layout effect below).
      if (focus === "piece") s.focusPiece = true;
      else earRef.current?.focus({ preventScroll: true });
      animateTo(restValue());
    };

    const toggle = () => {
      s.touched = true;
      if (s.expanded) closeIndex();
      else openIndex();
    };

    const setHover = (v: boolean) => {
      if (s.hovering === v) return;
      s.hovering = v;
      setHovering(v);
    };

    // Ends the press in hand, from pointerup, pointercancel, lost capture, a
    // stale press found by a fresh pointerdown, or a window blur. Every path
    // clears `dragging`; only a drag settles the fold (a click's own click
    // event toggles).
    const endPress = (x: number | null, y: number | null, pointerType: string) => {
      const p = s.press;
      if (!p) return;
      s.press = null;
      if (s.dragging) {
        s.dragging = false;
        setDragging(false);
      }
      if (!p.drag) return;
      // The click that follows a drag's own up is swallowed. A drag ended
      // without its up (a blur) keeps swallowing until the next press or key,
      // so the late up's click can't toggle the index open.
      s.suppressClick = true;
      if (x !== null)
        setTimeout(() => {
          s.suppressClick = false;
        }, 0);
      setHover(x !== null && y !== null && s.canHover && pointerType !== "touch" && inEar(x, y));
      if (releaseTarget(s.cut, window.innerWidth, window.innerHeight) === "open") openIndex();
      else if (s.expanded) closeIndex();
      else animateTo(restValue());
    };

    const onPointerDown = (e: PointerEvent<HTMLAnchorElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // A modified click opens /all in a new tab or window, as a link does.
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (s.press) {
        // A second finger on the corner is ignored; the same pointer pressing
        // again means its last up never arrived, so that press ends first.
        if (s.press.id !== e.pointerId) return;
        endPress(null, null, e.pointerType);
      }
      s.suppressClick = false;
      // No native link drag, no text selection, no focus-on-press.
      if (e.pointerType === "mouse") e.preventDefault();
      s.touched = true;
      s.press = { id: e.pointerId, x: e.clientX, y: e.clientY, drag: false };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // A pointer that is already gone: the press still ends on pointerup.
      }
    };

    const onPointerMove = (e: PointerEvent<HTMLAnchorElement>) => {
      const p = s.press;
      if (!p || e.pointerId !== p.id) return;
      if (!p.drag && Math.hypot(e.clientX - p.x, e.clientY - p.y) >= PEEL.slop) {
        p.drag = true;
        s.dragging = true;
        setDragging(true);
        cancelAnimationFrame(s.raf);
        s.raf = 0;
      }
      if (p.drag) apply(cutFromPointer(e.clientX, e.clientY, window.innerWidth, window.innerHeight));
    };

    const onPointerEnd = (e: PointerEvent<HTMLAnchorElement>) => {
      const p = s.press;
      if (!p || e.pointerId !== p.id) return;
      // A press that never moved past the slop is a click: the click event
      // that follows toggles, so a keyboard or assistive-tech click does too.
      endPress(e.clientX, e.clientY, e.pointerType);
    };

    const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
      // Ctrl/Cmd/Shift or a middle click: the browser opens /all itself.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      if (s.suppressClick) {
        s.suppressClick = false;
        return;
      }
      toggle();
    };

    const onKeyDown = (e: KeyboardEvent<HTMLAnchorElement>) => {
      // Enter activates the link natively (a click, handled above); Space
      // would scroll the page.
      s.suppressClick = false;
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      }
    };

    const onPointerEnter = (e: PointerEvent<HTMLAnchorElement>) => {
      if (e.pointerType === "touch" || !s.canHover) return;
      s.touched = true;
      setHover(true);
      if (!s.expanded && !s.press) animateTo(PEEL.hover);
    };

    const onPointerLeave = (e: PointerEvent<HTMLAnchorElement>) => {
      if (e.pointerType === "touch" || s.press) return;
      setHover(false);
      if (!s.expanded) animateTo(PEEL.rest);
    };

    const onIndexClick = (e: MouseEvent<HTMLElement>) => {
      // Choosing the piece already open closes the index onto it; any other
      // piece navigates as a plain link.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest("a");
      const entry = a?.closest("[data-op-entry]")?.getAttribute("data-op-entry");
      if (a && entry && entry === currentSlug) {
        e.preventDefault();
        closeIndex({ focus: "piece" });
      }
    };

    return {
      isOurs,
      apply,
      animateTo,
      openIndex,
      closeIndex,
      endPress,
      handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onLostPointerCapture: onPointerEnd, onClick, onKeyDown, onPointerEnter, onPointerLeave },
      onIndexClick,
    };
  }

  if (!api.current) api.current = makeApi();
  const a = api.current;

  // Media queries, the hint, history, Escape, resize and the verify hooks.
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const hover = matchMedia("(hover: hover)");
    const sync = () => {
      s.reduced = reduce.matches;
      s.canHover = hover.matches;
    };
    sync();
    reduce.addEventListener("change", sync);
    hover.addEventListener("change", sync);

    // The restrained corner hint: once per load, never under reduced motion,
    // never once the reader has touched the corner.
    const hintTimer = window.setTimeout(() => {
      if (s.reduced || s.touched || s.expanded || s.press) return;
      s.hintFired = true;
      setHintFired(true);
      a.animateTo(PEEL.hintTo, PEEL.hintOutMs, () => a.animateTo(PEEL.rest, PEEL.hintBackMs));
    }, PEEL.hintDelayMs);

    // A marker this mount did not write (left by an earlier load and kept by
    // Next across the reload or traversal) is scrubbed, Next's own keys kept,
    // so a stale entry never reads as an open index under us.
    const scrubStale = () => {
      const st = history.state as { opIndex?: unknown } | null;
      if (st?.opIndex !== undefined && !a.isOurs(st)) history.replaceState({ ...st, opIndex: undefined }, "");
    };
    s.token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    scrubStale();

    const onPop = (e: PopStateEvent) => {
      if (a.isOurs(e.state)) {
        // Forward onto our entry: reopen without pushing another.
        s.pushed = true;
        a.openIndex(false);
        return;
      }
      scrubStale();
      if (s.expanded) a.closeIndex({ fromPop: true });
      else s.pushed = false;
    };
    // A press held through a window blur (an alt-tab mid-drag) ends as a
    // release, so it can never leave the fold stuck to a pointer.
    const onBlur = () => {
      const id = s.press?.id;
      if (id === undefined) return;
      a.endPress(null, null, "mouse");
      try {
        earRef.current?.releasePointerCapture(id);
      } catch {
        // Capture already gone with the pointer.
      }
    };
    window.addEventListener("blur", onBlur);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && s.expanded) {
        e.preventDefault();
        a.closeIndex();
      }
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", onKey);

    // The overlay's viewBox tracks its own box (innerWidth less any
    // classic scrollbar), so one SVG unit stays one CSS pixel, as the
    // index's clip-path counts them.
    const svg = svgRef.current;
    const fit = () => {
      if (svg) svg.setAttribute("viewBox", `0 0 ${svg.clientWidth || window.innerWidth} ${svg.clientHeight || window.innerHeight}`);
      if (s.expanded && !s.raf && !s.press) a.apply(Math.max(s.cut, far()));
      else a.apply(s.cut);
    };
    fit();
    const ro = svg ? new ResizeObserver(fit) : null;
    if (svg) ro?.observe(svg);
    window.addEventListener("resize", fit);

    const w = window as unknown as { __offprints?: unknown };
    w.__offprints = {
      get cut() {
        return s.cut;
      },
      get open() {
        return s.open;
      },
      get hintFired() {
        return s.hintFired;
      },
      get dragging() {
        return s.dragging;
      },
    };

    return () => {
      window.clearTimeout(hintTimer);
      cancelAnimationFrame(s.raf);
      reduce.removeEventListener("change", sync);
      hover.removeEventListener("change", sync);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", fit);
      ro?.disconnect();
      delete w.__offprints;
    };
  }, [a, s]);

  // Fully open: the page behind stops scrolling and focus moves to the
  // index's heading. Closing restores the scroll. A layout effect, so both
  // land in the same commit that hides the piece and un-inerts the index
  // (`open` flips inside a rAF, where passive effects wait for a paint).
  useLayoutEffect(() => {
    if (!open) {
      if (s.focusPiece) {
        s.focusPiece = false;
        mainRef.current?.focus({ preventScroll: true });
      }
      return;
    }
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    navRef.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    return () => {
      html.style.overflow = prev;
    };
  }, [open, s]);

  return {
    refs: { earRef, mainRef, navRef, svgRef, flatRef, shadowRef, blurRef, gradRef, flapRef, creaseRef },
    open,
    expanded,
    dragging,
    hovering,
    hintFired,
    handlers: a.handlers,
    onIndexClick: a.onIndexClick,
  };
}
