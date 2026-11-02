import { test } from "node:test";
import assert from "node:assert/strict";
import { hostName, decide, publicHref } from "../lib/offprints/host.ts";

test("hostName lowercases and strips the port", () => {
  assert.equal(hostName("Offprints.LOCALHOST:3000"), "offprints.localhost");
  assert.equal(hostName(null), "");
});

test("Offprints host rewrites public paths onto the prefix", () => {
  assert.deepEqual(decide("offprints.neelayranjan.dev", "/", ""), { kind: "rewrite", to: "/offprints" });
  assert.deepEqual(decide("offprints.localhost:3000", "/hybrid-attention", "?x=1"), { kind: "rewrite", to: "/offprints/hybrid-attention" });
  assert.deepEqual(decide("offprints.localhost", "/robots.txt", ""), { kind: "rewrite", to: "/offprints/robots.txt" });
  assert.deepEqual(decide("offprints.localhost", "/offprints/icons/icon-192.png", ""), { kind: "pass" });
  assert.deepEqual(decide("offprints.localhost", "/offprints/all", ""), { kind: "redirect", to: "/all", status: 308 });
  assert.deepEqual(decide("offprints.localhost", "/offprints", ""), { kind: "redirect", to: "/", status: 308 });
});

test("apex redirects the prefix to the subdomain", () => {
  assert.deepEqual(decide("neelayranjan.dev", "/offprints/hybrid-attention", "?a=b"), { kind: "redirect", to: "https://offprints.neelayranjan.dev/hybrid-attention?a=b", status: 308 });
  assert.deepEqual(decide("www.neelayranjan.dev", "/offprints", ""), { kind: "redirect", to: "https://offprints.neelayranjan.dev/", status: 308 });
  assert.deepEqual(decide("neelayranjan.dev", "/lab", ""), { kind: "pass" });
});

test("other hosts pass through", () => {
  assert.deepEqual(decide("portfolio-abc.vercel.app", "/offprints/all", ""), { kind: "pass" });
  assert.deepEqual(decide("localhost:3000", "/", ""), { kind: "pass" });
});

test("publicHref strips the prefix only on an Offprints host", () => {
  assert.equal(publicHref("/offprints/all", "offprints.localhost"), "/all");
  assert.equal(publicHref("/offprints", "offprints.neelayranjan.dev"), "/");
  assert.equal(publicHref("/offprints/all", "localhost"), "/offprints/all");
  assert.equal(publicHref("https://neelayranjan.dev", "offprints.localhost"), "https://neelayranjan.dev");
});
