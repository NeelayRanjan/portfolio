#!/usr/bin/env node
/**
 * Voice gate for content/copy.ts and content/sky-facts.ts (CLAUDE.md's Voice
 * section, binding for all visitor-facing copy; the sky facts joined
 * 2026-09-15, spec docs/superpowers/specs/2026-09-15-sky-objects-design.md §7).
 *
 * Scans only STRING LITERALS in the file (a small hand-rolled scanner, not a
 * full TS parser: it walks the source char by char, tracking whether it is
 * inside a line comment, a block comment, or a quoted/backtick string, so
 * comment text — which is full of em dashes and section markers by design —
 * never gets mistaken for a visitor-facing string). Each string is reported
 * under the nearest `identifier:` that preceded it, which is good enough to
 * point at an offending key without a real AST.
 *
 * Checks:
 *   1. Em dashes (—) anywhere. Never allowed.
 *   2. En dashes (–) used as a connector. Allowed only between two digits
 *      (a range: "1900–2200", "98–99%") — anything else ("2024–now",
 *      "trick – reused") is the em-dash-shaped hyphenation CLAUDE.md bans in
 *      spirit too, so it is flagged the same way.
 *   3. Banned words/phrases from CLAUDE.md's Voice section list.
 *   4. A couple of the banned constructions that are cheap to regex
 *      reliably (rule-of-three's "not just X, but Y" family, "it's not
 *      about X, it's about Y", sentences opening on "Indeed"/"Moreover").
 *
 * URL-shaped strings (http(s)://, mailto:, or a bare "/path") are skipped
 * for every check: they are not prose, and "references" itself is exactly
 * where these live (résumé/CV/GitHub/ORCID/email links, the /lab route).
 *
 * In content/sky-facts.ts the citation fields (author, year, title, site,
 * url, accessed, and anything inside a `citations:` list) are skipped too:
 * they are the SOURCE's own words, reproduced for the reference list, not
 * this site's voice. Everything a card says in its own words (kind, oneLiner,
 * body, visibility) is scanned with the same rules as copy.ts. A verbatim
 * quote in a body that would trip a rule is not an exemption: paraphrase it.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES = [
  { rel: "content/copy.ts", skipKeys: new Set() },
  {
    rel: "content/sky-facts.ts",
    skipKeys: new Set(["author", "year", "title", "site", "url", "accessed", "citations"]),
  },
];

const BANNED_WORDS = [
  "delve",
  "dive into",
  "unlock",
  "unleash",
  "harness",
  "leverage",
  "elevate",
  "empower",
  "foster",
  "seamless",
  "robust",
  "cutting-edge",
  "state-of-the-art",
  "game-changing",
  "revolutionary",
  "showcase",
  "testament",
  "tapestry",
  "realm",
  "landscape",
  "journey",
  "crucial",
  "pivotal",
  "vital",
  "meticulous",
  "comprehensive",
  "holistic",
  "nuanced",
  "vibrant",
  "profound",
  "it's worth noting",
  "at its core",
  "let's explore",
];

// Cheap, regex-checkable slices of the banned CONSTRUCTIONS list (the rest —
// rhetorical questions, "In conclusion" — need real reading, not a scanner).
const BANNED_CONSTRUCTIONS = [
  { name: "not just X, but Y", re: /\bnot just\b.{0,40}\bbut\b/i },
  { name: "isn't merely X, it's Y", re: /\bisn't merely\b/i },
  { name: "more than just", re: /\bmore than just\b/i },
  { name: "it's not about X, it's about Y", re: /\bit'?s not about\b.{0,60}\bit'?s about\b/i },
  { name: "starts with Indeed/Moreover", re: /(^|[.!?]\s+)(Indeed|Moreover)\b/ },
  { name: "In conclusion / Ultimately", re: /\b(in conclusion|ultimately)\b/i },
];

function isUrlLike(value) {
  const v = value.trim();
  return /^(https?:\/\/|mailto:|\/[a-zA-Z0-9])/i.test(v);
}

/**
 * Hand-rolled scanner: walks the source once, tracking comment/string state,
 * and returns every string literal's content plus the nearest preceding
 * `identifier:` (the "key" it reports against).
 */
function extractStrings(src) {
  const results = [];
  let i = 0;
  const n = src.length;
  let currentKey = "?";
  let line = 1;

  const isIdentStart = (c) => /[A-Za-z_$]/.test(c);
  const isIdentPart = (c) => /[A-Za-z0-9_$]/.test(c);

  while (i < n) {
    const c = src[i];

    if (c === "\n") {
      line++;
      i++;
      continue;
    }

    // Line comment.
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }

    // Block comment.
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") line++;
        i++;
      }
      i += 2;
      continue;
    }

    // Single- or double-quoted string.
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let buf = "";
      while (j < n && src[j] !== quote) {
        if (src[j] === "\\") {
          buf += src[j + 1];
          if (src[j + 1] === "\n") line++;
          j += 2;
          continue;
        }
        if (src[j] === "\n") line++;
        buf += src[j];
        j++;
      }
      results.push({ key: currentKey, value: buf, line });
      i = j + 1;
      continue;
    }

    // Template literal. Interpolated `${...}` segments are skipped (they are
    // code, not prose); everything else between backticks is scanned.
    if (c === "`") {
      let j = i + 1;
      let buf = "";
      while (j < n && src[j] !== "`") {
        if (src[j] === "\\") {
          buf += src[j + 1];
          j += 2;
          continue;
        }
        if (src[j] === "$" && src[j + 1] === "{") {
          j += 2;
          let depth = 1;
          while (j < n && depth > 0) {
            if (src[j] === "{") depth++;
            else if (src[j] === "}") depth--;
            if (src[j] === "\n") line++;
            j++;
          }
          continue;
        }
        if (src[j] === "\n") line++;
        buf += src[j];
        j++;
      }
      results.push({ key: currentKey, value: buf, line });
      i = j + 1;
      continue;
    }

    // Identifier: remember it as the pending "key" if immediately followed
    // (after whitespace) by a colon — i.e. it's an object key, not a value
    // reference.
    if (isIdentStart(c)) {
      let j = i;
      while (j < n && isIdentPart(src[j])) j++;
      const ident = src.slice(i, j);
      let k = j;
      while (k < n && /\s/.test(src[k])) k++;
      if (src[k] === ":" && src[k + 1] !== ":") {
        currentKey = ident;
      }
      i = j;
      continue;
    }

    i++;
  }

  return results;
}

function checkString(key, value, line) {
  const issues = [];
  if (isUrlLike(value)) return issues;

  if (value.includes("—")) {
    issues.push(`em dash (—)`);
  }

  for (let idx = 0; idx < value.length; idx++) {
    if (value[idx] === "–") {
      const prev = value[idx - 1] ?? "";
      const next = value[idx + 1] ?? "";
      const isDigitRange = /[0-9]/.test(prev) && /[0-9]/.test(next);
      if (!isDigitRange) {
        issues.push(`en dash (–) used as a connector, not a digit-digit range`);
      }
    }
  }

  const lower = value.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) {
      issues.push(`banned word "${word}"`);
    }
  }

  for (const { name, re } of BANNED_CONSTRUCTIONS) {
    if (re.test(value)) {
      issues.push(`banned construction (${name})`);
    }
  }

  return issues.map((issue) => ({ key, value, line, issue }));
}

function main() {
  const violations = [];
  const scanned = [];
  for (const { rel, skipKeys } of FILES) {
    const raw = readFileSync(path.join(__dirname, "..", rel), "utf8");
    const strings = extractStrings(raw).filter(({ key }) => !skipKeys.has(key));
    scanned.push(`${strings.length} in ${rel}`);
    for (const { key, value, line } of strings) {
      violations.push(...checkString(key, value, line).map((v) => ({ ...v, rel })));
    }
  }

  if (violations.length > 0) {
    console.error(`check-voice: ${violations.length} violation(s)\n`);
    for (const v of violations) {
      const preview = v.value.length > 90 ? v.value.slice(0, 90) + "…" : v.value;
      console.error(`  ${v.rel}:${v.line}  key "${v.key}"  ${v.issue}`);
      console.error(`    "${preview}"`);
    }
    process.exit(1);
  }

  console.log(`check-voice: passed (string literals scanned: ${scanned.join(", ")})`);
  process.exit(0);
}

main();
