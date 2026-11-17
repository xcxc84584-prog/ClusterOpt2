import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LinkCore } from "../LinkCore/LinkCore.js";

test("PR8 Patch25 Fix1 publishes current version through LinkCore", () => {
  const core = new LinkCore();
  const version = core.getSnapshot().version;
  assert.equal(version, "0.0.8-pr8.patch25.fix2");
  assert.equal(core.edpmu.get("SystemVersion"), version);
});

test("PR8 Patch25 Fix1 resolves all project-relative entry assets", () => {
  const html = readFileSync(new URL("../../index.html", import.meta.url),
    "utf8");
  const resources = [...html.matchAll(
    /(?:src|href)="(\.\/[^"]+)"/gu
  )].map(match => match[1]);
  assert.ok(resources.includes("./favicon.svg"));
  for (const resource of resources) {
    const url = new URL("../../" + resource.slice(2), import.meta.url);
    const content = readFileSync(url);
    assert.ok(content.byteLength > 0, "Missing asset " + resource);
  }
  const icon = readFileSync(new URL("../../favicon.svg", import.meta.url),
    "utf8");
  assert.match(icon, /<svg\b/u);
});
