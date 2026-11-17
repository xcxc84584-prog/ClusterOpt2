import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

function receiver(id, auth = "Public", agent = true) {
  return {
    id,
    authorization: { highlight: auth, inspect: "Public" },
    receive: async (action, payload) =>
      action === "highlight" ? id + ":" + payload.text :
        id + ":inspect",
    ocda: {
      Request: ["highlight", "inspect"], Response: [],
      UserAPI: ["highlight", "inspect"],
      AgentAPI: agent ? ["highlight", "inspect"] : [],
      Property: [], Program: {}, EHU: [], Log: []
    }
  };
}
function provider(id, providerId) {
  return {
    manifestVersion: 1, providerId, objectId: id,
    provides: [{
      service: "editor.highlight", action: "highlight",
      version: "1.0.0", inputSchema: { type: "object" },
      outputSchema: { type: "string" }
    }],
    requires: [], permissions: [],
    execution: { isolation: "worker", concurrency: "serial" }
  };
}
function route(providerId, overrides = {}) {
  return {
    routeId: "editor.default",
    service: "editor.highlight", action: "highlight",
    mode: "replace", providers: [providerId],
    sourceFilter: { origins: ["user", "agent"], objects: [] },
    priority: 0, timeoutMs: 3000, ...overrides
  };
}
function configure(core, routes) {
  return core.configureReplaceRoutes({ schemaVersion: 1, routes });
}
function setup(core = new LinkCore()) {
  for (const id of ["Caller", "Other", "A", "B"]) {
    core.register(receiver(id));
  }
  assert.equal(core.registerProvider("A",
    provider("A", "vendor.a")).status, 201);
  assert.equal(core.registerProvider("B",
    provider("B", "vendor.b")).status, 201);
  return core;
}
test("PR04.03 replace only the chosen Service/action", async () => {
  const core = setup();
  assert.equal((await core.requestService("Caller",
    "editor.highlight", "highlight", { text: "x" })).status, 409);
  const input = route("vendor.b");
  assert.equal(configure(core, [input]).status, 200);
  input.providers[0] = "vendor.a";
  const actual = await core.requestService("Caller",
    "editor.highlight", "highlight", { text: "ok" },
    { origin: "user" });
  assert.equal(actual.value, "B:ok");
  assert.equal((await core.request("Caller", "A",
    "highlight", { text: "direct" })).value, "A:direct");
  assert.equal((await core.request("Caller", "B",
    "inspect", {})).value, "B:inspect");
  assert.equal((await core.requestService("Caller",
    "editor.highlight", "highlight", { text: "legacy" })).status, 409);
  assert.ok(core.getSnapshot().logs.some(event =>
    event.action === "Service.Route.Configure" &&
    event.status === 200));
});
test("PR04.03 source/origin filter and priority are deterministic",
  async () => {
    const core = setup();
    assert.equal(configure(core, [
      route("vendor.a", {
        routeId: "editor.general", priority: 0,
        sourceFilter: { origins: ["user"], objects: [] }
      }),
      route("vendor.b", {
        routeId: "editor.specific", priority: 10,
        sourceFilter: { origins: ["user"], objects: ["Caller"] }
      })
    ]).status, 200);
    const call = async (source, origin) => core.requestService(
      source, "editor.highlight", "highlight", { text: "t" },
      { origin });
    assert.equal((await call("Caller", "user")).value, "B:t");
    assert.equal((await call("Other", "user")).value, "A:t");
    assert.equal((await call("Caller", "agent")).status, 409);
  });
test("PR04.03 validates table atomically and never silently falls back",
  async () => {
    const core = setup();
    assert.equal(configure(core, [route("vendor.a")]).status, 200);
    assert.equal(configure(core, [
      route("vendor.b"), route("vendor.missing", {
        routeId: "editor.bad", priority: 3
      })
    ]).status, 404);
    const use = async () => core.requestService("Caller",
      "editor.highlight", "highlight", { text: "x" },
      { origin: "user" });
    assert.equal((await use()).value, "A:x");
    assert.equal(configure(core, [route("vendor.b", {
      mode: "chain"
    })]).status, 400);
    assert.equal((await use()).value, "A:x");
    core.setProviderEnabled("A", "vendor.a", false);
    assert.equal((await use()).status, 404);
    core.setProviderEnabled("A", "vendor.a", true);
    assert.equal((await use()).value, "A:x");
    core.unregisterProvider("A", "vendor.a");
    assert.equal((await use()).status, 404);
    assert.equal(configure(core, [route("vendor.b")]).status, 200);
    assert.equal((await use()).value, "B:x");
    assert.equal(configure(core, []).status, 200);
    assert.equal((await use()).value, "B:x");
  });
test("PR04.03 preserves AccessPolicy, origin API and EHU", async () => {
  const core = setup();
  core.unregister("B");
  core.register(receiver("B", "Private", false));
  assert.equal(core.registerProvider("B",
    provider("B", "vendor.b")).status, 201);
  assert.equal(configure(core, [route("vendor.b")]).status, 200);
  assert.equal((await core.requestService("Caller",
    "editor.highlight", "highlight", {}, {
      origin: "user"
    })).status, 403);
  assert.equal((await core.requestService("B",
    "editor.highlight", "highlight", { text: "self" }, {
      origin: "user"
    })).value, "B:self");
  assert.equal((await core.requestService("B",
    "editor.highlight", "highlight", {}, {
      origin: "agent"
    })).status, 403);
  assert.ok(core.getSnapshot().logs.some(event =>
    event.kind === "EHU" && event.status === 403));
  assert.deepEqual(core.getSnapshot().dependencies, [
    { link: "B->B", code: "11" }
  ]);
});
test("PR04.03 VTE identity, no global route persistence or public UI",
  async () => {
    const env = new VirtualTestEnvironment();
    env.core.register(receiver("A"));
    env.core.register(receiver("B"));
    env.core.registerProvider("A", provider("A", "vendor.a"));
    env.core.registerProvider("B", provider("B", "vendor.b"));
    assert.equal(configure(env.core, [route("vendor.a")]).status, 200);
    const result = await env.core.requestService("VTE",
      "editor.highlight", "highlight", { text: "v" },
      { origin: "user" });
    assert.equal(result.value, "A:v");
    assert.equal(new LinkCore().hub.replaceRoutes.length, 0);
    assert.ok(!Object.hasOwn(env.core.api ?? {}, "configureReplaceRoutes"));
  });
