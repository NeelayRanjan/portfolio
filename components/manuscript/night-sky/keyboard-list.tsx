"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { copy } from "@/content/copy";
import { constellationAt, type Highlight } from "@/lib/sky-render";
import { isStargazing } from "@/lib/stargaze";
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
 */

/** How often the stargaze keyboard list re-reads what's on screen. */
const LIST_REFRESH_MS = 2000;

/** One button in the stargaze keyboard list (F2). */
export type ListItem = { kind: Highlight["kind"]; id: string; label: string };
export type ListActions = {
  open: (item: ListItem, el: HTMLElement) => void;
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
  };
  const startList = () => {
    refreshList();
    if (!listTimer) listTimer = window.setInterval(refreshList, LIST_REFRESH_MS);
  };
  const stopList = () => {
    window.clearInterval(listTimer);
    listTimer = 0;
    listSignature = "";
    setListItems([]);
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
  };
  /** Unmount only: clears the timer without a setState on an unmounting component. */
  const dispose = () => window.clearInterval(listTimer);

  return { startList, stopList, actions, dispose };
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
}: {
  slot: HTMLElement | null;
  items: ListItem[];
  actionsRef: MutableRefObject<ListActions | null>;
}) {
  return slot && items.length
    ? createPortal(
        <div data-sky-list role="group" aria-label={copy.stargaze.listLabel} className="sr-only">
          {items.map((item) => (
            <button
              key={`${item.kind}:${item.id}`}
              type="button"
              data-sky-list-item={item.id}
              onClick={(e) => actionsRef.current?.open(item, e.currentTarget)}
              onFocus={() => actionsRef.current?.focus(item)}
              onBlur={() => actionsRef.current?.blur(item)}
            >
              {item.label}
            </button>
          ))}
        </div>,
        slot,
      )
    : null;
}
