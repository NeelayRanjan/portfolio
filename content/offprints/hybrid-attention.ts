// Copy for No. 1, Hybrid attention. Voice rules apply. No imports.
// Placeholders in `readout` are filled by the figure.
export const hybridAttention = {
  abstract:
    "Alibaba says Qwen3.8-Flash-Next is the Qwen 4 architecture [1]. It keeps one attention layer in four and replaces the other three with a fixed-size memory that is overwritten as the text goes by. Figure 1 shows what the attention layer does with a sentence.",
  why: "Attention gets more expensive with every token it has to look back over. A fixed-size memory costs the same at token ten and token ten thousand, so keeping a few attention layers for exact lookup and using memory for the rest cuts the bill on long text.",
  words: {
    before:
      "The memory layer holds a matrix S. Each token first decays it by a gate α_t, then writes its value at its key, undoing whatever the key used to point to by a strength β_t:",
    equation: {
      lhs: "S_t",
      rhs: "α_t (I − β_t k_t k_tᵀ) S_{t−1} + β_t k_t v_tᵀ",
    },
    after:
      "Reading is one multiplication, y_t = S_tᵀ q_t, so the cost per token never grows [2].",
  },
  figure1: {
    caption:
      "One attention head reading a sentence. Qwen3.5-0.8B-Base, layer 7, head 1, actual weights, extracted 1 Nov 2026.",
    nudge: "Click any token to ask from it.",
    readout: "“{from}” puts {pct}% of its attention on “{to}”",
    undo: "undo",
    // Shown in Figure 1's box until the real figure lands.
    placeholder: "Figure 1 is being built.",
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
