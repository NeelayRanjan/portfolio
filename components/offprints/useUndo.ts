"use client";

import { useCallback, useReducer } from "react";
import { initialUndo, undoReducer, type UndoState, type UndoAction } from "@/lib/offprints/undo";

export function useUndo<T>(initial: T) {
  const [state, dispatch] = useReducer(
    undoReducer as (s: UndoState<T>, a: UndoAction<T>) => UndoState<T>,
    initial,
    initialUndo<T>,
  );
  const set = useCallback((value: T) => dispatch({ type: "set", value }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const reset = useCallback(() => dispatch({ type: "reset", value: initial }), [initial]);
  return { value: state.value, set, undo, canUndo: state.past.length > 0, reset };
}
