import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";

function object(id) {
  return { id, receive: async () => null,
    ocda: { Request: ["highlight"], Response: [],
      UserAPI: ["highlight"], AgentAPI: [], Property: [],
      Program: {}, EHU: [], Log: [] } };
}
function manifest(objectId, providerId, sharedProperties) {
  return {
    manifestVersion: 1, objectId, providerId,
    provides: [{
      service: "editor.highlight", action: "highlight",
      version: "1.0.0", inputSchema: { type: "object" },
      outputSchema: { type: "array", items: { type: "string" } }
    }],
    requires: [], permissions: [],
    execution: { isolation: "worker", concurrency: "serial" },
    ...(sharedProperties === undefined ? {} : { sharedProperties })
  };
}
test("PR03.04 writing shared property requires EDPMU owner and claim",
  () => {
    const core = new LinkCore();
    core.register(object("PluginA"));
    core.register(object("PluginB"));
    core.hub.registerProperty("SharedMode", "default", {
      owners: ["PluginA"], visibility: "Public"
    });
    const claim = [{ name: "SharedMode", access: "write",
      isolation: "shared" }];
    assert.equal(core.registerProvider("PluginB",
      manifest("PluginB", "vendor.b", claim)).status, 403);
    assert.equal(core.registerProvider("PluginA",
      manifest("PluginA", "vendor.a", claim)).status, 201);
    assert.equal(core.publishProviderProperty(
      "PluginB", "vendor.a", "SharedMode", "bad").status, 403);
    assert.equal(core.edpmu.get("SharedMode"), "default");
    assert.equal(core.publishProviderProperty(
      "PluginA", "vendor.a", "SharedMode", "safe").status, 200);
    assert.equal(core.edpmu.get("SharedMode"), "safe");
    assert.ok(core.getSnapshot().logs.some(event =>
      event.kind === "EHU" &&
      event.action === "Provider.Property.Write"));
  });

test("PR03.04 missing and undeclared Properties fail closed", () => {
  const core = new LinkCore();
  core.register(object("PluginA"));
  assert.equal(core.registerProvider("PluginA", manifest(
    "PluginA", "vendor.a", [{
      name: "MissingProperty", access: "write", isolation: "shared"
    }])).status, 404);
  assert.equal(core.registerProvider("PluginA",
    manifest("PluginA", "vendor.a")).status, 201);
  assert.equal(core.publishProviderProperty("PluginA",
    "vendor.a", "SystemVersion", "hacked").status, 403);
  assert.equal(core.edpmu.get("SystemVersion"), core.version);
});

test("PR03.05 Service candidates share one URU authority", () => {
  const core = new LinkCore();
  core.register(object("PluginA"));
  core.register(object("PluginB"));
  assert.equal(core.registerProvider("PluginA",
    manifest("PluginA", "vendor.a")).status, 201);
  assert.equal(core.registerProvider("PluginB",
    manifest("PluginB", "vendor.b")).status, 201);
  const result = core.services.resolve("editor.highlight");
  assert.equal(result.status, 200);
  assert.deepEqual(result.value.map(item => item.providerId),
    ["vendor.a", "vendor.b"]);
  assert.equal(core.services.resolve("Unknown.Service").status, 400);
  assert.equal(core.services.resolve("missing.service").status, 404);
  core.unregister("PluginA");
  assert.deepEqual(core.services.resolve("editor.highlight")
    .value.map(item => item.providerId), ["vendor.b"]);
  core.unregisterProvider("PluginB", "vendor.b");
  assert.equal(core.services.resolve("editor.highlight").status, 404);
  assert.deepEqual(core.services.list(), []);
});
