// Copy for No. 1, Hybrid attention. Voice rules apply. No imports.
// Placeholders in `readout` are filled by the figure.
export const hybridAttention = {
  abstract:
    "Alibaba says Qwen3.8-Flash-Next is the Qwen 4 architecture [1]. It keeps one attention layer in four and replaces the other three with a fixed-size memory that is overwritten as the text goes by. Figure 1 shows what the attention layer does with a sentence.",
  why: "Attention gets more expensive with every token it has to look back over. A fixed-size memory costs the same at token ten and token ten thousand, so keeping a few attention layers for exact lookup and using memory for the rest cuts the bill on long text.",
  // The maths is composed, never typed as TeX: a term is { base, sub, sup },
  // rendered with real <sub>/<sup> (components/offprints/MathText.tsx).
  // "⊤" is the transpose.
  words: {
    before: [
      "The memory layer holds a matrix S. Each token first decays it by a gate ",
      { base: "α", sub: "t" },
      ", then writes its value at its key, undoing whatever the key used to point to by a strength ",
      { base: "β", sub: "t" },
      ":",
    ],
    equation: {
      lhs: [{ base: "S", sub: "t" }],
      rhs: [
        { base: "α", sub: "t" },
        " (I − ",
        { base: "β", sub: "t" },
        " ",
        { base: "k", sub: "t" },
        " ",
        { base: "k", sub: "t", sup: "⊤" },
        ") ",
        { base: "S", sub: "t−1" },
        " + ",
        { base: "β", sub: "t" },
        " ",
        { base: "k", sub: "t" },
        " ",
        { base: "v", sub: "t", sup: "⊤" },
      ],
    },
    after: [
      "Reading is one multiplication, ",
      { base: "y", sub: "t" },
      " = ",
      { base: "S", sub: "t", sup: "⊤" },
      " ",
      { base: "q", sub: "t" },
      ", so the cost per token never grows [2].",
    ],
  },
  figure1: {
    // Filled from figure1.json (model, layer, defaultHead, extracted), so the
    // caption can't go stale against the data.
    caption:
      "One attention head reading a sentence. {model}, layer {layer}, head {head}, weights extracted {date}.",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    nudge: "Click any token to ask from it.",
    // {to} and {pct} are the best EARLIER token and its share of all the
    // asking token's attention; the first token has none, so it gets its own line.
    readout: "“{from}” puts {pct}% of its attention on “{to}”",
    readoutFirst: "“{from}” is the first token and has nothing earlier to look at.",
    undo: "undo",
    // Chip titles: a seen token's weight, and a token after the asking one.
    weight: "weight {w}",
    selfWeight: "weight on itself {w}",
    future: "not yet seen (causal)",
    // The figure's accessible name; the chips are its buttons.
    label: "Tokens of the sentence. Choose one to ask from it.",
  },
  definitions: [
    { term: "Query", symbol: "q", text: "What the asking token wants. Outlined in blue above." },
    {
      term: "Key",
      symbol: "k",
      text: "What each token offers to be found by. The green tint is how well it matches.",
    },
    { term: "Value", symbol: "v", text: "What the matched token hands back, weighted by the match." },
  ],
} as const;
