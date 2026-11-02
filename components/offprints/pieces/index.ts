import type { ComponentType } from "react";
import type { Piece } from "@/content/offprints/pieces";
import { HybridAttentionPiece } from "./hybrid-attention/Piece";
import { TestSheetPiece } from "./test-sheet/Piece";

/** Every piece's component, keyed by its registry slug. */
export const PIECE_COMPONENTS: Record<string, ComponentType<{ piece: Piece }>> = {
  "hybrid-attention": HybridAttentionPiece,
  "test-sheet": TestSheetPiece,
};

/**
 * The component for a visible piece, or a thrown error. The pages call it
 * while rendering, so a registry entry with no component fails the build at
 * prerender (every visible slug is prerendered) instead of shipping a blank
 * page. It lives here, not inside PieceFrame, because each piece renders its
 * own PieceFrame: the frame never sees a piece that lacks a component.
 */
export function componentFor(piece: Piece): ComponentType<{ piece: Piece }> {
  const component = PIECE_COMPONENTS[piece.slug];
  if (!component) {
    throw new Error(`Offprints: no component registered for visible piece "${piece.slug}"`);
  }
  return component;
}
