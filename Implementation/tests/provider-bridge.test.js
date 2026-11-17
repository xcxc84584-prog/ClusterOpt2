import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

function provider(id, service = "editor.highlight") {
  return {
    manifestVersion: 1, providerId: id, objectId: "PluginA",
    provides: [{
      service, action: "highlight", version: "1.0.0",
      inputSchema: { type: "object" },
      outputSchema: { type: "array", items: { type: "string" } }
    }],
    requires: [], permissions: [],
    execution: { isolation: "worker", concurrency: "serial" }
  };
}
function object(id = "PluginA") {
  return {
    id, receive: async () => null,
    ocda: {
      Request: ["highlight"], Response: [],
      UserAPI: ["highlight"], AgentAPI: [], Property: [],
      Program: {}, EHU: [], Log: []
    }
  };
}

test("PR03.03 URU owns bindings and removes them on Object deletion",
  () => {
    const core = new LinkCore();
    assert.equal(core.registerProvider("PluginA",
      provider("vendor.a")).status, 404);
    assert.equal(core.register(object()), true);
    const registered = core.registerProvider("PluginA", provider("vendor.a"));
    assert.equal(registered.status, 201);
    assert.equal(core.uru.getProvider("vendor.a").objectId, "PluginA");
    assert.equal(core.uru.listProviders().length, 1);
    assert.equal(core.registerProvider("PluginA",
      provider("vendor.a")).status, 409);
    assert.equal(core.unregister("PluginA"), true);
    assert.equal(core.uru.getProvider("vendor.a"), null);
    assert.equal(core.uru.listProviders().length, 0);
    assert.equal(core.uru.objects.has("PluginA"), false);
  });

test("PR03.03 blocks impersonation and undeclared actions", () => {
  const core = new LinkCore();
  core.register(object());
  core.register(object("Intruder"));
  assert.equal(core.registerProvider("Intruder",
    provider("vendor.a")).status, 403);
  const wrong = provider("vendor.b");
  wrong.provides[0].action = "notDeclared";
  assert.equal(core.registerProvider("PluginA", wrong).status, 400);
  assert.equal(core.uru.listProviders().length, 0);
  assert.ok(core.getSnapshot().logs.some(log =>
    log.kind === "EHU" && log.action === "Provider.Register" &&
    log.status === 403));
});

test("PR03.03 only owning Object can explicitly unregister", () => {
  const core = new LinkCore();
  core.register(object());
  core.register(object("Intruder"));
  core.registerProvider("PluginA", provider("vendor.a"));
  assert.equal(core.unregisterProvider("Intruder", "vendor.a").status,
    403);
  assert.equal(core.uru.listProviders().length, 1);
  assert.equal(core.unregisterProvider("PluginA", "vendor.a").status,
    200);
  assert.equal(core.unregisterProvider("PluginA", "vendor.a").status,
    404);
});

test("PR03.03 VTE preserves existing Request/REP/EventChain behavior",
  async () => {
    const env = new VirtualTestEnvironment();
    assert.equal(env.create("listener").status, 201);
    const before = await env.act("listener", "listener", "ping",
      { test: true });
    assert.equal(before.status, 200);
    assert.ok(env.snapshot().dependencies.some(link =>
      link.code === "10" || link.code === "01" || link.code === "11"));
    assert.equal(env.core.uru.listProviders().length, 0);
  });

test("PR03.10 global Service dependency cycles fail without partial index",
  () => {
    const core = new LinkCore();
    core.register(object("PluginA"));
    core.register(object("PluginB"));
    const a = provider("vendor.a", "service.first");
    a.requires = ["service.second"];
    assert.equal(core.registerProvider("PluginA", a).status, 201);
    const b = provider("vendor.b", "service.second");
    b.objectId = "PluginB";
    b.requires = ["service.first"];
    assert.equal(core.registerProvider("PluginB", b).status, 409);
    assert.equal(core.uru.getProvider("vendor.b"), null);
    assert.equal(core.services.resolve("service.second").status, 404);
    assert.equal(core.services.resolve("service.first").status, 200);
    assert.ok(core.getSnapshot().logs.some(event =>
      event.kind === "EHU" && event.action === "Provider.Register" &&
      event.status === 409));
  });

test("PR03.03 revoked Proxy Manifest fails closed with EHU 400", () => {
  const core = new LinkCore();
  core.register(object());
  const proxy = Proxy.revocable({}, {});
  proxy.revoke();
  const result = core.registerProvider("PluginA", proxy.proxy);
  assert.equal(result.status, 400);
  assert.equal(core.uru.listProviders().length, 0);
  assert.ok(core.getSnapshot().logs.some(event =>
    event.kind === "EHU" && event.action === "Provider.Register" &&
    event.status === 400));
});

test("PR03.08 Provider must agree with declared Object API contract", () => {
  const core = new LinkCore();
  const existing = object();
  existing.ocda.APIDescriptors = [{
    apiVersion: 1, id: "editor.highlight", owner: "PluginA",
    action: "highlight", version: "2.0.0", visibility: "Public",
    sideEffect: "none", inputSchema: { type: "object" },
    outputSchema: { type: "array", items: { type: "string" } }
  }];
  assert.equal(core.register(existing), true);
  assert.equal(core.registerProvider("PluginA",
    provider("vendor.a")).status, 400);
  const compatible = provider("vendor.a");
  compatible.provides[0].version = "2.0.0";
  assert.equal(core.registerProvider("PluginA", compatible).status, 201);
});
