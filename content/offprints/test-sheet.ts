// Copy for the fixture piece (No. 0). Never published. No imports.
export const testSheet = {
  abstract: "A fixture that exists so the checks have a second entry.",
  why: "It keeps the index honest when it holds more than one piece.",
  // One section of its own, so the running section numbers have something
  // to count before the frame's sections.
  section: {
    heading: "A numbered section",
    body: "Its number comes from the frame, which counts a piece's own sections before the frame's.",
  },
  figure1: {
    caption: "A dashed box where a figure would sit.",
    nudge: "Nothing to try here.",
    placeholder: "no figure",
  },
  definition: {
    term: "fixture",
    symbol: "F",
    body: "a page that exists only so the checks have something to read.",
  },
  // Subscripts are composed in the piece: base letter, then sub.
  equation: {
    lhs: { base: "F", sub: "t" },
    rhs: { base: "F", sub: "t−1", tail: "+ 1" },
  },
  table: {
    caption: "Two made-up rows.",
    head: ["row", "count"],
    rows: [
      ["first", "12"],
      ["second", "345"],
    ],
  },
} as const;
