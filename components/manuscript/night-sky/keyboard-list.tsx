"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { copy } from "@/content/copy";
import { constellationAt, type Highlight } from "@/lib/sky-render";
import { isStargazing } from "@/lib/stargaze";
import { isListPanelOpen, setListHasItems, setListPanelOpen, subscribeBrowse, useListPanelOpen } from "@/lib/stargaze-browse";
import type { CardModel } from "../SkyCard";
import type { CardController } from "./card-controller";
import type { SkyState } from "./state";

/**
 * The stargaze keyboard list (final review F2): the canvas is aria-hidden,
 * so in stargaze mode a visually hidden list of buttons, one per selectable
 * currently on screen, is portalled into StargazeToggle's slot right after
 * the exit control. It refreshes every LIST_REFRESH_MS, and only re-renders
 * when the set changes; a focused button rings its subject on the canvas
 * through the hover highlight.
 *
 * The list panel (discoverability spec §4): the hint bar's "browse the list"
 * shows this SAME list, the same buttons in the same order, as a visible,
 * titled, scrollable panel with its own close button. There is one list and
 * two presentations, so the two can't drift: closed, the group is sr-only
 * exactly as before (its wrapper is a plain div, which adds nothing to the
 * accessibility tree); open, the wrapper becomes a labelled region styled
 * like SkyCard. Buttons keep their identity across the switch, so focus
 * survives opening and closing.
 *
 * Panel and card, decided:
 * - >= 880px the panel sits under the hint bar at the column's right edge
 *   and stays open while a card opens from it; the card draws above it
 *   (z-30 over z-20), so a visitor can read one card and pick the next.
 * - Below 880px both dock to the bottom, so a card opened from the panel
 *   takes the panel's place: the panel is hidden (display none) while the
 *   card is open and comes back when the card closes, with focus returned to
 *   the button that opened it (the card controller's usual opener rule).
 * - Escape peels one visible layer per press, in the capture phase like the
 *   card's: the panel, then the card, then stargaze itself. On a phone the
 *   panel is not visible under a docked card, so there the card goes first,
 *   then the panel it uncovers.
 * - Closing the panel moves focus only if it was inside the panel (to
 *   "browse the list"), or on an Escape with focus on nothing; focus in an
 *   open card stays there.
 * - Leaving stargaze closes the panel (NightSky's stargaze subscriber).
 * - While the panel is open its rows are frozen (final review m3): the 2s
 *   refresh skips, so a row can't move under a pointer aiming at it as the
 *   sky turns. The list refreshes once on opening and again on closing, and
 *   the timer's refresh resumes after close. A row whose subject has left
 *   the screen still opens its card, which then shows the out-of-view line
 *   (card-controller's followCard). Frozen means open, not only visible: on
 *   a phone the panel hidden under a docked card comes back with the rows
 *   the visitor left.
 */

/** How often the stargaze keyboard list re-reads what's on screen. */
const LIST_REFRESH_MS = 2000;

/** One button in the stargaze keyboard list (F2). */
export type ListItem = { kind: Highlight["kind"]; id: string; label: string };
export type ListActions = {
  open: (item: ListItem, el: HTMLElement) => void;
  closePanel: () => void;
  focus: (item: ListItem) => void;
  blur: (item: ListItem) => void;
};

export type KeyboardListDeps = {
  cards: Pick<CardController, "buildCard" | "positionOf">;
  setHighlight: (next: Highlight | null) => void;
  setCard: (model: CardModel | null) => void;
  setListItems: (items: ListItem[]) => void;
  openerRef: MutableRefObject<HTMLElement | null>;
  paint: () => void;
};

export function createKeyboardList(s: SkyState, deps: KeyboardListDeps) {
  const { cards, setHighlight, setCard, setListItems, openerRef, paint } = deps;
  const { buildCard, positionOf } = cards;
  let listTimer = 0;
  let listSignature = "";
  let panelWasOpen = isListPanelOpen();

  /** The panel is open and actually on screen (not hidden under a phone's docked card). */
  const panelVisible = () => isListPanelOpen() && !(s.narrowQ.matches && s.selected);
  const closePanel = (opts?: { byKey?: boolean }) => {
    if (!isListPanelOpen()) return;
    const active = document.activeElement;
    const focusInPanel = !!active?.closest("[data-sky-list-panel]");
    const focusNowhere = !active || active === document.body;
    setListPanelOpen(false);
    if (focusInPanel || (opts?.byKey && focusNowhere)) {
      document.querySelector<HTMLElement>("[data-stargaze-browse]")?.focus({ preventScroll: true });
    }
  };
  /** Capture phase, registered before the card's: a visible panel takes the Escape first. */
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !isStargazing() || !panelVisible()) return;
    e.stopImmediatePropagation();
    closePanel({ byKey: true });
  };

  // ---- the stargaze keyboard list (F2) ----
  const refreshList = () => {
    if (!isStargazing() || !s.projected || !s.sky || !s.facts) return;
    const sky = s.sky;
    const p = s.projected;
    const hitItems: ListItem[] = [];
    const conItems: ListItem[] = [];
    const label = (kind: Highlight["kind"], id: string) => {
      const model = buildCard({ kind, id });
      return model ? `${model.title}, ${model.fact.kind}` : null;
    };
    const seen = new Set<string>();
    const addHit = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      const l = label("hit", id);
      if (l) hitItems.push({ kind: "hit", id, label: l });
    };
    for (const h of p.hits) addHit(h.id);
    if (p.milkyWay) addHit("milky-way");
    for (const abbr of p.segments.keys()) {
      if (!constellationAt(p, abbr, s.width, s.height)) continue;
      const l = label("constellation", abbr);
      if (l) conItems.push({ kind: "constellation", id: abbr, label: l });
    }
    // A button that has focus stays in the list even if its subject just
    // left the screen, or focus would drop to the body under the visitor.
    const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.skyListItem;
    if (focusedId && !seen.has(focusedId) && !conItems.some((i) => i.id === focusedId)) {
      const kind: Highlight["kind"] = sky.constellations[focusedId] ? "constellation" : "hit";
      const l = label(kind, focusedId);
      if (l) (kind === "hit" ? hitItems : conItems).push({ kind, id: focusedId, label: l });
    }
    // Sorted by label, symbols then constellations: the order depends only
    // on which things are listed, so entries coming and going never
    // reshuffle the ones that stay.
    const byLabel = (a: ListItem, b: ListItem) => a.label.localeCompare(b.label, "en");
    const items = [...hitItems.sort(byLabel), ...conItems.sort(byLabel)];
    const signature = items.map((i) => `${i.kind}:${i.id}`).join("|");
    if (signature === listSignature) return;
    listSignature = signature;
    setListItems(items);
    setListHasItems(items.length > 0);
  };
  /** The timer's refresh: skipped while the panel is open (its rows are frozen). */
  const tick = () => {
    if (!isListPanelOpen()) refreshList();
  };
  // Opening refreshes once, then freezes; closing refreshes once, then the timer resumes.
  const unsubBrowse = subscribeBrowse(() => {
    const open = isListPanelOpen();
    if (open === panelWasOpen) return;
    panelWasOpen = open;
    refreshList();
  });
  const startList = () => {
    refreshList();
    if (!listTimer) listTimer = window.setInterval(tick, LIST_REFRESH_MS);
  };
  const stopList = () => {
    window.clearInterval(listTimer);
    listTimer = 0;
    listSignature = "";
    setListItems([]);
    setListHasItems(false);
  };
  const actions: ListActions = {
    open: (item, el) => {
      const model = buildCard(item);
      if (!model) return;
      openerRef.current = el;
      s.selected = { kind: item.kind, id: item.id };
      setCard(model);
      paint();
    },
    focus: (item) => {
      if (!s.projected) return;
      const at = positionOf(s.projected, item.kind, item.id) ?? { x: s.width / 2, y: s.height / 2 };
      setHighlight({ kind: item.kind, id: item.id, pointer: at });
    },
    blur: (item) => {
      if (s.highlight?.id === item.id) setHighlight(null);
    },
    closePanel: () => closePanel(),
  };
  /** Unmount only: clears the timer without a setState on an unmounting component. */
  const dispose = () => {
    window.clearInterval(listTimer);
    unsubBrowse();
  };

  return { startList, stopList, actions, dispose, onKeyDown, closePanel };
}

/** StargazeToggle renders the slot this list portals into. */
export function useListSlot(): HTMLElement | null {
  const [listSlot, setListSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // StargazeToggle renders the slot right after its exit control, so the
    // list follows it in tab order; both are in app/layout.tsx, so it exists
    // by the time this runs.
    setListSlot(document.querySelector<HTMLElement>("[data-sky-list-slot]"));
  }, []);
  return listSlot;
}

export function SkyKeyboardList({
  slot,
  items,
  actionsRef,
  cardOpen,
}: {
  slot: HTMLElement | null;
  items: ListItem[];
  actionsRef: MutableRefObject<ListActions | null>;
  /** A card is open: below 880px the docked card takes the panel's place. */
  cardOpen: boolean;
}) {
  const open = useListPanelOpen();
  const t = copy.stargaze;
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  // Opening moves focus into the panel (not onto a button, which would ring
  // its subject on the canvas before the visitor chose anything).
  useLayoutEffect(() => {
    if (open && !wasOpen.current) panelRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);
  if (!slot || (!open && !items.length)) return null;
  return createPortal(
    <div
      ref={panelRef}
      data-sky-list-panel={open ? "open" : "closed"}
      role={open ? "region" : undefined}
      aria-labelledby={open ? "sky-list-panel-title" : undefined}
      tabIndex={open ? -1 : undefined}
      className={
        open
          ? `fixed inset-x-0 bottom-0 z-20 flex max-h-[min(60dvh,calc(100dvh_-_var(--stargaze-hint-h,56px)_-_16px))] flex-col border-t border-rule bg-panel/95 font-mono text-[12px] text-mut shadow-[0_0_40px_rgba(0,0,0,0.6)] outline-none min-[880px]:top-[calc(var(--stargaze-hint-h,56px)_+_8px)] min-[880px]:bottom-auto min-[880px]:left-auto min-[880px]:right-[max(16px,calc((100vw_-_1000px)_/_2))] min-[880px]:max-h-[calc(100vh_-_var(--stargaze-hint-h,56px)_-_72px)] min-[880px]:w-[300px] min-[880px]:border min-[880px]:text-[11px]${cardOpen ? " max-[879px]:hidden" : ""}`
          : undefined
      }
    >
      {open ? (
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
          <h2 id="sky-list-panel-title" className="font-serif text-[17px] leading-snug text-ink">
            {t.listPanelTitle}
          </h2>
          <button
            type="button"
            data-sky-list-close
            onClick={() => actionsRef.current?.closePanel()}
            className="shrink-0 underline decoration-dotted underline-offset-[3px] transition-colors hover:text-ink"
          >
            {t.listPanelClose}
          </button>
        </div>
      ) : null}
      <div
        data-sky-list
        role="group"
        aria-label={t.listLabel}
        className={open ? "flex min-h-0 flex-col items-start overflow-y-auto px-4 pb-4" : "sr-only"}
      >
        {items.map((item) => (
          <button
            key={`${item.kind}:${item.id}`}
            type="button"
            data-sky-list-item={item.id}
            onClick={(e) => actionsRef.current?.open(item, e.currentTarget)}
            onFocus={() => actionsRef.current?.focus(item)}
            onBlur={() => actionsRef.current?.blur(item)}
            className={open ? "py-1 text-left leading-snug transition-colors hover:text-ink" : undefined}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>,
    slot,
  );
}
