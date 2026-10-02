import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

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

test("/adapter-contract says what phase 1 gives and what it does not", () => {
  const contract = page("adapter-contract/index.html");
  // The three moves, and the calls behind them.
  assert.match(contract, /externalKey/);
  assert.match(contract, /POST \/v1\/sessions\/\{id\}\/runs/);
  assert.match(contract, /idempotencyKey/);
  // Read on its own, it has to say where a missing feature falls.
  assert.match(contract, /does not give you/i);
  assert.match(contract, /phase 2/);
});

test("/incident-bot is a walkthrough against the CLI, not an illustration", () => {
  const example = page("incident-bot/index.html");
  for (const command of [/wisp connectors enable/, /wisp permissions allow-connector/, /wisp run/, /wisp audit/]) {
    assert.match(example, command);
  }
});

test("the operator pages name every state, reason and code a phase-1 operator meets", () => {
  const runbook = page("runbook/index.html");
  for (const state of ["ready", "booting", "login_required", "proxy_failed", "attestation_failed"]) {
    assert.match(runbook, new RegExp(state));
  }
  for (const reason of [
    "attestation_blocked", "stream_stalled", "context_overflow", "step_ceiling", "shutdown",
    "quota_exhausted", "not_entitled", "billing_unavailable", "rate_limit", "server_error",
    "network", "internal",
  ]) {
    assert.match(runbook, new RegExp(reason));
  }
  assert.match(runbook, /78/);
  // The window, where it is configured, and the unit it has to agree with.
  const restarts = page("runs-and-restarts/index.html");
  assert.match(restarts, /SHUTDOWN_DRAIN_TIMEOUT_MS/);
  assert.match(restarts, /TimeoutStopSec/);
});

test("the look is Infima variables and the landing's heading font, with nothing ejected", () => {
  const home = page("index.html");
  const stylesheet = home.match(/href=(\/assets\/css\/[^\s>"]+\.css)/)?.[1];
  assert.ok(stylesheet, "the page loads no stylesheet");
  const css = page(stylesheet.slice(1));
  // White paper and a neutral dark surface, both painted through Infima's own
  // variables rather than by overriding the theme's rules.
  assert.match(css, /--ifm-background-color:\s*#fff(fff)?\b/);
  assert.match(css, /--ifm-background-color:\s*#16171a/);
  assert.match(css, /--ifm-heading-font-family:[^;]*Satoshi/);
  // An ejected theme component is owned forever and comes due at the next minor
  // upgrade: phase 1 swizzles nothing.
  assert.ok(!existsSync(new URL("../src/theme", import.meta.url)), "src/theme/ holds an ejected component");
});
