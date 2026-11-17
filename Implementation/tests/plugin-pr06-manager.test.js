import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LinkCore } from "../LinkCore/LinkCore.js";

test("PR06.08 four pages are separate and no inert overview tab", () => {
  const html = readFileSync(new URL("../../index.html", import.meta.url),
    "utf8");
  const source = readFileSync(new URL(
    "../main/plugin-manager-ui.js", import.meta.url), "utf8");
  assert.match(html, /id="pluginManagerPages"/);
  assert.doesNotMatch(html, /id="pluginToolToggle"/);
  assert.match(html, /id="pluginMaxMiB"/);
  assert.doesNotMatch(html, /class="plugin-workbench-header"/);
  assert.doesNotMatch(html, /id="pluginUnlimited"/);
  assert.match(source, /"permissions","api","ehu","performance"/);
  assert.match(source, /core\.catalog\.collect\(\)/);
  assert.match(source, /event\.isTrusted/);
  assert.match(source, /grantPluginPermission\(/);
  assert.match(source, /revokePluginPermission\(/);
  assert.match(source, /textContent=String\(value\)/);
});

test("PR06.08 real permissions are URU-owned, no simulated fixtures", () => {
  const core = new LinkCore();
  assert.equal(core.uru.listProviders().length, 0);
  assert.equal(typeof core.checkPluginPermission, "function");
});
