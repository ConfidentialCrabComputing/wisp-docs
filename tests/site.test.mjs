import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** A page of the last build, as the browser is served it (minified HTML). */
function page(path) {
  return readFileSync(new URL(`../build/${path}`, import.meta.url), "utf8");
}

test("the site names docs.usewisp.io and serves its assets from the root", () => {
  const home = page("index.html");
  assert.equal(home.match(/rel=canonical href=(\S+)/)?.[1], "https://docs.usewisp.io/");
  // `baseUrl` is baked into every asset URL at build time, so a prefix here is
  // one the site is stuck with — and behind a proxy a wrong one 404s the lot.
  const assets = [...home.matchAll(/(?:href|src)=(\/[^\s>"]+\.(?:css|js))/g)].map((m) => m[1]);
  assert.ok(assets.length > 0, "the page loads no stylesheet or script at all");
  for (const url of assets) {
    assert.match(url, /^\/assets\//, `${url} carries a path prefix`);
  }
});

test("/quickstart goes from a machine with nothing installed to an answered run", () => {
  const quickstart = page("quickstart/index.html");
  assert.match(quickstart, /curl -fsSL https:\/\/usewisp\.io\/install\.sh \| sh/);
  assert.match(quickstart, /wisp serve/);
  assert.match(quickstart, /wisp login/);
  assert.match(quickstart, /wisp run/);
  assert.match(quickstart, /wisp connectors enable/);
});
