// Pure reducer behind useUndo. No imports, so plain node can test it.
export type UndoState<T> = { value: T; past: T[] };
export type UndoAction<T> =
  | { type: "set"; value: T }
  | { type: "undo" }
  | { type: "reset"; value: T };

export function initialUndo<T>(value: T): UndoState<T> {
  return { value, past: [] };
}

export function undoReducer<T>(state: UndoState<T>, action: UndoAction<T>): UndoState<T> {
  switch (action.type) {
    case "set":
      return { value: action.value, past: [...state.past, state.value] };
    case "undo": {
      if (state.past.length === 0) return state;
      return { value: state.past[state.past.length - 1], past: state.past.slice(0, -1) };
    }
    case "reset":
      return { value: action.value, past: [] };
  }
}
