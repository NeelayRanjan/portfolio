import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decide } from "@/lib/offprints/host";

export function proxy(req: NextRequest) {
  const d = decide(req.headers.get("host"), req.nextUrl.pathname, req.nextUrl.search);
  if (d.kind === "rewrite") {
    const url = new URL(d.to, req.url);
    url.search = req.nextUrl.search;
    return NextResponse.rewrite(url);
  }
  if (d.kind === "redirect") {
    if (d.to.startsWith("https://")) return NextResponse.redirect(d.to, d.status);
    const url = new URL(d.to, req.url);
    url.search = req.nextUrl.search;
    return NextResponse.redirect(url, d.status);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/|api/).*)"] };
