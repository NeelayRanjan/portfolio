import { test } from "node:test";
import assert from "node:assert/strict";
import { undoReducer, initialUndo } from "../lib/offprints/undo.ts";

test("past is empty at start", () => {
  assert.deepEqual(initialUndo(1), { value: 1, past: [] });
});

test("set twice then undo returns the first value", () => {
  let s = initialUndo("a");
  s = undoReducer(s, { type: "set", value: "b" });
  s = undoReducer(s, { type: "set", value: "c" });
  s = undoReducer(s, { type: "undo" });
  assert.equal(s.value, "b");
  assert.deepEqual(s.past, ["a"]);
});

test("undo on an empty past is a no-op", () => {
  const s = initialUndo(5);
  assert.equal(undoReducer(s, { type: "undo" }), s);
});

test("reset clears past", () => {
  let s = initialUndo(1);
  s = undoReducer(s, { type: "set", value: 2 });
  s = undoReducer(s, { type: "reset", value: 9 });
  assert.deepEqual(s, { value: 9, past: [] });
});
