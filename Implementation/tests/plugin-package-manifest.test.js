import test from "node:test";
import assert from "node:assert/strict";
import { PluginPackageManifestPolicy as Policy } from
  "../property/PluginPackageManifestPolicy.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

function packageText(changes = {}) {
  const provider = {
    manifestVersion: 1,
    providerId: "example.user-lexer",
    objectId: "Example.UserLexer",
    provides: [{
      service: "editor.syntax.tokens",
      action: "tokenize",
      version: "1.0.0",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" }
    }],
    requires: [],
    permissions: ["document.slice.read"],
    execution: { isolation: "worker", concurrency: "per-slice" }
  };
  return JSON.stringify({
    packageVersion: 1,
    name: "My local syntax extension",
    entry: "dist/index.js",
    provider,
    ...changes
  });
}

test("PR13.1 accepts a dynamic user provider without static allowlist", () => {
  const checked = Policy.validate(packageText());
  assert.equal(checked.status, 200);
  assert.equal(checked.value.provider.providerId, "example.user-lexer");
  assert.equal(checked.value.provider.permissions[0],
    "document.slice.read");
  assert.equal(Object.isFrozen(checked.value.provider), true);
  assert.equal(Object.isFrozen(checked.value), true);
});

test("PR13.1 denies traversal, remote URLs and absolute entries", () => {
  for (const entry of [
    "../index.js", "/index.js", "a/../index.js",
    "https://bad.example/plugin.js", "C:/plugin.js",
    "a\\index.js", "a//index.js", "./index.js"
  ]) {
    assert.equal(Policy.validate(packageText({ entry })).status, 400,
      entry);
  }
});

test("PR13.1 rejects host execution and malformed contracts", () => {
  const base = JSON.parse(packageText());
  base.provider.execution.isolation = "host";
  assert.equal(Policy.validate(JSON.stringify(base)).status, 400);
  base.provider.execution.isolation = "worker";
  base.provider.provides[0].version = "invalid";
  assert.equal(Policy.validate(JSON.stringify(base)).status, 400);
  assert.equal(Policy.validate(packageText({ unknown: true })).status, 400);
  assert.equal(Policy.validate(packageText({ packageVersion: 2 })).status,
    400);
  assert.equal(Policy.validate("not json").status, 400);
  assert.equal(Policy.validate("x".repeat(65537)).status, 400);
});

test("PR13.1 metadata validation never registers or grants", () => {
  const env = new VirtualTestEnvironment();
  const before = env.core.uru.listProviders().length;
  const check = env.core.readProperty("VTE",
    "PluginPackageManifestPolicy");
  assert.equal(check.status, 200);
  assert.equal(check.value.validate(packageText()).status, 200);
  assert.equal(env.core.uru.listProviders().length, before);
  assert.equal(env.snapshot().dependencies.length, 0);
  assert.ok(env.log().some(entry =>
    entry.action === "Property.Read" && entry.status === 200));
});
