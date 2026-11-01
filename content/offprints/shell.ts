// Offprints shell copy: the chrome around every piece. Voice rules apply
// (scripts/check-voice.mjs). No imports.
export const shell = {
  meta: {
    siteName: "Offprints",
    title: "Offprints",
    description:
      "Recent favorite ideas in AI, drawn rather than written. Interactive explainers by Neelay Ranjan.",
  },
  ear: {
    label: "All pieces",
    hint: "all pieces · drag to peek",
  },
  index: {
    masthead: "Offprints",
    line: "Recent favorite ideas, drawn rather than written. Neelay Ranjan.",
    contents: "Contents",
    open: "(open)",
    callPrefix: "my call: ",
    revisitPrefix: "revisited: ",
    draft: "draft",
    feed: "RSS",
    home: "neelayranjan.dev",
  },
  piece: {
    abstract: "Abstract",
    references: "References",
    cite: "cite this piece",
    copy: "copy",
    copied: "copied",
    selected: "selected",
    why: "Why it matters now",
    words: "Words, if you want them",
    revisited: "Revisited",
    callLine: "my call",
    revisitLine: "revisited",
    footRss: "RSS",
  },
  homeMark: {
    title: "Back to neelayranjan.dev",
  },
  notFound: {
    heading: "No such piece",
    lede: "Nothing is filed at this address. It may be a draft, or the link may be wrong.",
    back: "back to all pieces",
  },
} as const;
