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
} as const;
