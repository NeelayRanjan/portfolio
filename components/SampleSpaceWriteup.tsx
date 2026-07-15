import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";

/**
 * Renders content/sample-space.md beneath the sample-space panel.
 *
 * Server component: the file is read at build time, so the markdown stays the
 * single source of truth without shipping a parser to the browser. The copy only
 * uses paragraphs, **bold** and *italic*, so a full markdown dependency would be
 * a lot of weight for three constructs — this handles exactly those and nothing
 * else. If the copy ever needs lists, links or headings, swap in a real parser
 * rather than growing this.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Alternates: plain, **bold**, plain, *italic*, ...
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      out.push(
        <strong key={`${keyBase}-b${i}`} className="text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(
        <em key={`${keyBase}-i${i}`} className="text-muted italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = m.index + token.length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function SampleSpaceWriteup() {
  const path = join(process.cwd(), "content", "sample-space.md");
  const paragraphs = readFileSync(path, "utf8")
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  return (
    <div className="mt-10 max-w-2xl border-l border-line pl-6">
      {paragraphs.map((p, i) => (
        <p key={i} className="mb-4 leading-relaxed text-muted last:mb-0">
          {inline(p, `p${i}`)}
        </p>
      ))}
    </div>
  );
}
