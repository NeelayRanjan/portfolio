/**
 * Board -> plane encoding for the EBM chess engine.
 *
 * A JS port of `training/encoding.py` from the entropy-chess repo. It must match
 * that file EXACTLY: the model scores resulting positions E(s') from the
 * perspective of the player who just moved, and a wrong transform produces
 * legal-but-terrible moves rather than an error. Validated against the handoff's
 * vectors A and B (see scripts/../test) — if you touch this, re-run them.
 *
 * Shape (18, 8, 8) float32, values in {0, 1}, indexed [plane][row][col].
 *
 *   0-5    self pieces P N B R Q K   ("self" = the perspective colour)
 *   6-11   opponent pieces, same order
 *   12     side-to-move flag: 1 iff the perspective is to move. Always 0 for an
 *          s' encoding, because the opponent is to move there.
 *   13     self kingside castling right   (constant plane)
 *   14     self queenside
 *   15     opponent kingside
 *   16     opponent queenside
 *   17     en passant one-hot, ONLY if a legal ep capture exists
 *
 * The square transform is identity for white, rank-mirror (sq ^ 56) for black.
 * FILES ARE NEVER FLIPPED — that would swap king and queenside.
 */
import type { Chess, Color, PieceSymbol } from "chess.js";

export const NUM_PLANES = 18;
export const PLANE_SIZE = 64;
export const TENSOR_SIZE = NUM_PLANES * PLANE_SIZE;

/** Exactly the reference's order. Reordering silently corrupts every encoding. */
const PIECE_ORDER: PieceSymbol[] = ["p", "n", "b", "r", "q", "k"];

/** "e4" -> 28, with a1 = 0 and h8 = 63, matching python-chess. */
export function squareIndex(square: string): number {
  const file = square.charCodeAt(0) - 97; // 'a'
  const rank = square.charCodeAt(1) - 49; // '1'
  return rank * 8 + file;
}

/**
 * Encodes `position` from `perspective` into an (18,8,8) tensor.
 *
 * `position` is s' — the board AFTER the candidate move — and `perspective` is
 * the player who made that move.
 */
export function encodeBoard(
  position: Chess,
  perspective: Color,
  out: Float32Array = new Float32Array(TENSOR_SIZE),
): Float32Array {
  out.fill(0);
  const mirror = perspective === "b";

  const set = (plane: number, sq: number) => {
    const s = mirror ? sq ^ 56 : sq;
    out[plane * PLANE_SIZE + (s >> 3) * 8 + (s & 7)] = 1;
  };
  const fill = (plane: number) => {
    out.fill(1, plane * PLANE_SIZE, (plane + 1) * PLANE_SIZE);
  };

  for (const row of position.board()) {
    for (const cell of row) {
      if (!cell) continue;
      const typeIndex = PIECE_ORDER.indexOf(cell.type);
      const offset = cell.color === perspective ? 0 : 6;
      set(offset + typeIndex, squareIndex(cell.square));
    }
  }

  // Always 0 for s' (the opponent is to move), but computed rather than
  // hardcoded so this matches the reference encoder for any board.
  if (position.turn() === perspective) fill(12);

  // Rights per FEN — "has the right", not "can castle this move".
  const fen = position.fen().split(" ");
  const rights = fen[2];
  const white = perspective === "w";
  if (rights.includes(white ? "K" : "k")) fill(13);
  if (rights.includes(white ? "Q" : "q")) fill(14);
  if (rights.includes(white ? "k" : "K")) fill(15);
  if (rights.includes(white ? "q" : "Q")) fill(16);

  // Only when an ep capture is actually LEGAL — a set ep square in the FEN is
  // not enough. Keeps the encoding invariant to live-board vs FEN round-trips.
  const epSquare = fen[3];
  if (epSquare !== "-") {
    const legalEp = position
      .moves({ verbose: true })
      .some((m) => m.flags.includes("e"));
    if (legalEp) set(17, squareIndex(epSquare));
  }

  return out;
}
