/** Host rules for Offprints. No imports: tested in plain node, used by proxy.ts and a client component. */
export const OFFPRINTS_PREFIX = "/offprints";
const CANONICAL = "https://offprints.neelayranjan.dev";

export function hostName(hostHeader: string | null | undefined): string {
  if (!hostHeader) return "";
  return hostHeader.toLowerCase().replace(/:\d+$/, "");
}

export function isOffprintsHost(host: string): boolean {
  return hostName(host).startsWith("offprints.");
}

export function isApexHost(host: string): boolean {
  const h = hostName(host);
  return h === "neelayranjan.dev" || h === "www.neelayranjan.dev";
}

const ROOT_FILES = new Set(["robots.txt", "sitemap.xml", "feed.xml"]);

export function isAssetPath(pathname: string): boolean {
  const last = pathname.split("/").pop() ?? "";
  if (ROOT_FILES.has(last)) return false;
  return /\.[A-Za-z0-9]+$/.test(last);
}

export type Decision =
  | { kind: "pass" }
  | { kind: "rewrite"; to: string }
  | { kind: "redirect"; to: string; status: 308 };

function hasPrefix(pathname: string): boolean {
  return pathname === OFFPRINTS_PREFIX || pathname.startsWith(OFFPRINTS_PREFIX + "/");
}

function stripPrefix(pathname: string): string {
  return pathname.slice(OFFPRINTS_PREFIX.length) || "/";
}

export function decide(hostHeader: string | null, pathname: string, search: string): Decision {
  const host = hostHeader ?? "";
  if (isApexHost(host)) {
    if (hasPrefix(pathname)) {
      return { kind: "redirect", to: CANONICAL + stripPrefix(pathname) + search, status: 308 };
    }
    return { kind: "pass" };
  }
  if (!isOffprintsHost(host)) return { kind: "pass" };
  if (hasPrefix(pathname)) {
    if (pathname.startsWith(OFFPRINTS_PREFIX + "/") && isAssetPath(pathname)) return { kind: "pass" };
    return { kind: "redirect", to: stripPrefix(pathname), status: 308 };
  }
  return { kind: "rewrite", to: pathname === "/" ? OFFPRINTS_PREFIX : OFFPRINTS_PREFIX + pathname };
}

export function publicHref(href: string, hostname: string): string {
  if (!isOffprintsHost(hostname)) return href;
  const path = href.split(/[?#]/)[0];
  if (!hasPrefix(path)) return href;
  return stripPrefix(path) + href.slice(path.length);
}
