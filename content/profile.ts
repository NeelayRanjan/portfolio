/**
 * Hero copy and links. Sourced from content/resume-notes.md — update both together.
 */
export const PROFILE = {
  name: "Neelay Ranjan",
  /** Sub-text under the nameplate. */
  subtext: "energy-based models · diffusion · flight-path generation",
  /** Longer form — used for page metadata rather than shown in the hero. */
  tagline:
    "Generative-modeling researcher. Diffusion for safety-critical, data-scarce domains.",
  affiliation: "NASA Ames · Regenstrief Institute",
  /**
   * Where the resume lives. Deliberately NOT in `public/`: it changes often, and
   * an external URL means updating it needs no commit and no redeploy — edit the
   * doc and the link is current.
   *
   * Set this to the hosted URL and the Resume link appears in the hero. Left
   * empty, the link simply isn't rendered — no dead link ships.
   *
   * `/preview`, NOT the `/edit?usp=sharing&ouid=...` URL Drive hands you when you
   * click Share. Three reasons, all checked against the live doc rather than
   * assumed:
   *   - `ouid` is the owner's Google account id. It does nothing for a visitor.
   *   - `/edit` opens the full Docs editing chrome for a read-only viewer.
   *   - `/export?format=pdf` works, but sends `Content-Disposition: attachment`,
   *     so it downloads a file named `RESUME_Neelay_Ranjan.docx.pdf` instead of
   *     showing anything. `/preview` renders in the tab and still offers download.
   * The file is an uploaded .docx, not a native Doc, and it is shared
   * `{role: reader, type: anyone}` — verified, or this link would wall visitors
   * behind a request-access screen.
   */
  resumeUrl:
    "https://docs.google.com/document/d/1-qa5lXInCIQoPsL4uvpHWgShjfeeVh_l/preview",
  links: [
    { label: "GitHub", href: "https://github.com/NeelayRanjan" },
    { label: "LinkedIn", href: "https://linkedin.com/in/neelayranjan" },
    { label: "Email", href: "mailto:neelay.ranjan@outlook.com" },
  ],
} as const;
