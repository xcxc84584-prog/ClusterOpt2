import test from "node:test";
import assert from "node:assert/strict";
import { PluginPermissionPolicy } from
  "../property/PluginPermissionPolicy.js";
import { PluginMessagePolicy } from
  "../property/PluginMessagePolicy.js";
import { LinkCore } from "../LinkCore/LinkCore.js";

function register(core) {
  core.register({
    id: "PluginOwner",
    receive: async () => null,
    ocda: { Request: ["run"], Response: [],
      UserAPI: ["run"], AgentAPI: [], Property: [],
      Program: {}, EHU: [], Log: [] }
  });
  return core.registerProvider("PluginOwner", {
    manifestVersion: 1, providerId: "vendor.security",
    objectId: "PluginOwner",
    provides: [{ service: "test.security", action: "run",
      version: "1.0.0", inputSchema: { type: "object" },
      outputSchema: { type: "object" } }],
    requires: [], permissions: [
      "document.slice.read", "editor.decoration.publish",
      "route.configure"
    ],
    execution: { isolation: "worker", concurrency: "serial" }
  });
}

test("PR06.01/02 declared permissions do not grant authority", () => {
  const core = new LinkCore();
  assert.equal(register(core).status, 201);
  assert.equal(core.checkPluginPermission(
    "vendor.security", "document.slice.read"), false);
  assert.equal(core.grantPluginPermission(
    "PluginOwner", "vendor.security",
    "document.slice.read").status, 403);
  assert.equal(core.grantPluginPermission(
    "PluginOwner", "vendor.security",
    "document.slice.read", true).status, 200);
  assert.equal(core.checkPluginPermission(
    "vendor.security", "document.slice.read"), true);
  assert.equal(core.grantPluginPermission(
    "PluginOwner", "vendor.security",
    "route.configure", true).status, 403);
  assert.equal(core.grantPluginPermission(
    "Impostor", "vendor.security",
    "editor.decoration.publish", true).status, 404);
  assert.equal(core.revokePluginPermission(
    "PluginOwner", "vendor.security",
    "document.slice.read").status, 200);
  assert.equal(core.checkPluginPermission(
    "vendor.security", "document.slice.read"), false);
});

test("PR06.02 unknown/duplicate claims and Core permissions denied", () => {
  assert.equal(PluginPermissionPolicy.inspect(
    ["editor.decoration.publish"]).status, 200);
  for (const value of [["editor.decoration.publish",
    "editor.decoration.publish"], ["unknown.scope"], ["__proto__"]]) {
    assert.equal(PluginPermissionPolicy.inspect(value).status, 400);
  }
  assert.equal(PluginPermissionPolicy.authorize(
    "route.configure", true).status, 403);
});

test("PR06.05 message copies immutable data and rejects unsafe types",
  () => {
    const data = { rows: ["a", { line: 2 }] };
    const checked = PluginMessagePolicy.inspect(data);
    assert.equal(checked.status, 200);
    data.rows[0] = "changed";
    assert.equal(checked.value.rows[0], "a");
    assert.equal(Object.isFrozen(checked.value.rows[1]), true);
    const invalid = [
      { fn: () => null }, { value: new Date() },
      { value: new ArrayBuffer(8) },
      JSON.parse('{"__proto__":1}'),
      { value: Infinity }
    ];
    for (const bad of invalid) {
      assert.equal(PluginMessagePolicy.inspect(bad).ok, false);
    }
    const cycle = {}; cycle.self = cycle;
    assert.equal(PluginMessagePolicy.inspect(cycle).status, 400);
    const secret = {};
    Object.defineProperty(secret, "field", {
      enumerable: true, get() { throw Error("getter"); }
    });
    assert.equal(PluginMessagePolicy.inspect(secret).status, 400);
    assert.equal(PluginMessagePolicy.inspect(
      { payload: "x".repeat(66000) }).status, 413);
  });

test("PR06 grants expire on Provider unregister and reload", () => {
  const core = new LinkCore();
  register(core);
  core.grantPluginPermission(
    "PluginOwner", "vendor.security",
    "editor.decoration.publish");
  assert.equal(core.checkPluginPermission(
    "vendor.security", "editor.decoration.publish"), true);
  assert.equal(core.unregisterProvider(
    "PluginOwner", "vendor.security").status, 200);
  assert.equal(core.checkPluginPermission(
    "vendor.security", "editor.decoration.publish"), false);
  const fresh = new LinkCore();
  assert.equal(fresh.checkPluginPermission(
    "vendor.security", "editor.decoration.publish"), false);
  assert.ok(core.getSnapshot().logs.some(x =>
    x.action === "Plugin.Permission.Grant" && x.status === 200));
});
