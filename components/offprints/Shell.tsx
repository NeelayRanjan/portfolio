"use client";

import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { shell } from "@/content/offprints/shell";
import { publicHref } from "@/lib/offprints/host";
import { OFFPRINTS_PREFIX } from "@/lib/offprints/site";
import { PEEL, clipPolygon, flapPath, shadowBlur, shadowOffset } from "@/lib/offprints/peel";
import { HomeMark } from "./HomeMark";
import { flatPagePath, usePeel } from "./usePeel";

/**
 * The chrome around every piece (spec §6, §10.4): the dog-ear top left, the
 * index beneath the sheet, the fold, and the N mark top right.
 *
 * Layers, bottom to top: the piece, `main`, scrolling as the document and
 * never clipped; the index, a fixed full-viewport `nav` clipped to the
 * uncovered corner triangle (`x + y <= cut`); the fold, a fixed SVG that
 * draws the cast shadow, the flap and the crease and takes no pointer
 * events; the ear, a fixed 72px hit area clipped to its triangle. Scrolling
 * the piece leaves the last three anchored to the viewport corner. The ear
 * comes first in the DOM so it is the first tab stop (spec §6).
 *
 * Every first-paint attribute below is the rest geometry; from hydration
 * on, usePeel writes the live `cut` straight to these elements, and React
 * never rewrites them because their props never change.
 */
export function Shell({
  index,
  currentSlug,
  children,
}: {
  index: ReactNode;
  currentSlug?: string;
  children: ReactNode;
}) {
  const peel = usePeel(currentSlug);
  const { refs, handlers } = peel;
  const r = PEEL.rest;
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradId = `op-flap-${id}`;
  const blurId = `op-blur-${id}`;
  const flatId = `op-flat-${id}`;

  // The ear is a link to /all for no-JS readers and crawlers; on the
  // Offprints host its public form has no prefix (OffLink's swap).
  const earInternal = `${OFFPRINTS_PREFIX}/all`;
  const [earHref, setEarHref] = useState(earInternal);
  useEffect(() => {
    setEarHref(publicHref(earInternal, window.location.hostname));
  }, [earInternal]);

  const hintShown = peel.hovering && !peel.expanded && !peel.dragging;
  const o = shadowOffset(r);

  return (
    <>
      <a
        ref={refs.earRef}
        href={earHref}
        role="button"
        aria-label={shell.ear.label}
        aria-expanded={peel.expanded}
        data-op-ear
        draggable={false}
        className="fixed top-0 left-0 z-[33] block h-[72px] w-[72px] touch-none select-none"
        style={{ cursor: peel.dragging ? "grabbing" : "grab" }}
        {...handlers}
      />
      <span
        data-op-ear-hint
        aria-hidden="true"
        className={`pointer-events-none fixed top-[14px] left-[64px] z-[33] text-[13px] text-mut italic motion-safe:transition-opacity motion-safe:duration-150 ${hintShown ? "opacity-100" : "opacity-0"}`}
      >
        {shell.ear.hint}
      </span>

      <main
        ref={refs.mainRef}
        id="main"
        tabIndex={-1}
        data-op-piece
        style={peel.open ? { visibility: "hidden" } : undefined}
      >
        {children}
      </main>

      <nav
        ref={refs.navRef}
        aria-label={shell.ear.label}
        aria-hidden={peel.open ? undefined : true}
        inert={!peel.open}
        data-op-index
        data-op-under
        className="fixed inset-0 z-30 overflow-auto overscroll-contain"
        style={{ clipPath: clipPolygon(r) }}
        onClick={peel.onIndexClick}
      >
        {index}
      </nav>

      <svg
        ref={refs.svgRef}
        data-op-fold
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[31] h-full w-full"
      >
        <defs>
          <linearGradient
            ref={refs.gradRef}
            id={gradId}
            gradientUnits="userSpaceOnUse"
            x1={r / 2}
            y1={r / 2}
            x2={0.96 * r}
            y2={0.96 * r}
          >
            <stop offset="0" stopColor="#ece8df" />
            <stop offset="1" stopColor="#d8d2c5" />
          </linearGradient>
          <filter id={blurId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur ref={refs.blurRef} stdDeviation={shadowBlur(r)} />
          </filter>
          {/* The shadow falls on the flat page only, never into the corner. */}
          <clipPath id={flatId}>
            <path ref={refs.flatRef} clipRule="evenodd" d={flatPagePath(r)} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${flatId})`}>
          <path
            ref={refs.shadowRef}
            d={flapPath(r)}
            transform={`translate(${o} ${o})`}
            fill="rgba(29,27,23,0.16)"
            filter={`url(#${blurId})`}
          />
        </g>
        <path ref={refs.flapRef} data-op-flap d={flapPath(r)} fill={`url(#${gradId})`} />
        <line
          ref={refs.creaseRef}
          data-op-crease
          x1={r}
          y1={0}
          x2={0}
          y2={r}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1}
        />
      </svg>

      <HomeMark />
    </>
  );
}
