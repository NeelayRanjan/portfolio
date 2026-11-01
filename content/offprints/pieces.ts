// The Offprints registry: one entry per piece. No imports, so plain node loads it.
// A draft shows only outside production (lib/offprints/pieces.ts).
export type Verdict = "useful" | "useless";
export type RevisitVerdict = "held up" | "aged badly" | "mixed";
export type Citation = { label: string; title: string; venue: string; year: number; href?: string };
export type Piece = {
  slug: string;
  number: number;
  title: string;
  claim: string;
  published: string; // ISO date, "2026-11-01"
  status: "published" | "draft";
  call: { verdict: Verdict; date: string; line: string };
  revisit?: { verdict: RevisitVerdict; date: string; line: string };
  sources: Citation[];
};

export const PIECES: readonly Piece[] = [
  {
    slug: "test-sheet",
    number: 0,
    title: "A test sheet",
    claim: "A fixture that exists so the checks have a second entry.",
    published: "2026-10-31",
    status: "draft",
    call: { verdict: "useless", date: "2026-10-31", line: "" },
    sources: [
      { label: "1", title: "A fixture source", venue: "Nowhere", year: 2026 },
    ],
  },
  {
    slug: "hybrid-attention",
    number: 1,
    title: "Hybrid attention",
    claim: "How Qwen 4 reads a sentence with a quarter of the attention it used to.",
    published: "2026-11-01",
    status: "draft",
    call: { verdict: "useful", date: "2026-11-01", line: "" },
    sources: [
      {
        label: "1",
        title:
          "On the design of Qwen3.8-Next architecture: evaluation, efficiency, and training stability",
        venue: "Qwen team, arXiv 2608.30320",
        year: 2026,
        href: "https://arxiv.org/abs/2608.30320",
      },
      {
        label: "2",
        title: "Gated Delta Networks: improving Mamba2 with delta rule",
        venue: "S. Yang, J. Kautz, A. Hatamizadeh, ICLR",
        year: 2025,
      },
    ],
  },
];
