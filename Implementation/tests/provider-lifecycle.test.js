import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

function object(id) {
  return {
    id, receive: async (_action, payload) => payload,
    ocda: {
      Request: ["highlight"], Response: [], UserAPI: ["highlight"],
      AgentAPI: [], Property: [], Program: {}, EHU: [], Log: []
    }
  };
}
function manifest(id, providerId, version = "1.2.0") {
  return {
    manifestVersion: 1, objectId: id, providerId,
    provides: [{
      service: "editor.highlight", action: "highlight", version,
      inputSchema: { type: "object" },
      outputSchema: { type: "array", items: { type: "string" } }
    }],
    requires: [], permissions: [],
    execution: { isolation: "host", concurrency: "serial" }
  };
}

test("PR03.06 trusted Factory is lazy, owner checked, one instance", () => {
  const core = new LinkCore();
  core.register(object("PluginA"));
  core.register(object("Intruder"));
  core.registerProvider("PluginA", manifest("PluginA", "vendor.a"));
  let instances = 0;
  assert.equal(core.attachProviderFactory("Intruder", "vendor.a",
    () => ({})).status, 403);
  assert.equal(core.attachProviderFactory("PluginA", "vendor.a",
    () => ({ count: ++instances })).status, 201);
  assert.equal(instances, 0);
  assert.equal(core.services.resolve("editor.highlight").status, 200);
  assert.equal(instances, 0, "Catalog/Service lookup must be lazy");
  assert.equal(core.materializeProvider("Intruder", "vendor.a").status, 403);
  const started = core.materializeProvider("PluginA", "vendor.a");
  assert.equal(started.status, 201);
  assert.equal(started.value.count, 1);
  assert.equal(core.materializeProvider("PluginA", "vendor.a").status, 200);
  assert.equal(instances, 1);
  assert.equal(core.materializeProvider("PluginA", "unknown").status, 404);
});

test("PR03.07 disable Service independently and dispose once", () => {
  const core = new LinkCore();
  core.register(object("PluginA"));
  core.register(object("PluginB"));
  core.registerProvider("PluginA", manifest("PluginA", "vendor.a"));
  core.registerProvider("PluginB", manifest("PluginB", "vendor.b"));
  let disposed = 0;
  core.attachProviderFactory("PluginA", "vendor.a",
    () => ({ dispose() { disposed++; } }));
  core.materializeProvider("PluginA", "vendor.a");
  assert.equal(core.setServiceEnabled("PluginA", "vendor.a",
    "editor.highlight", false).status, 200);
  assert.deepEqual(core.services.resolve("editor.highlight")
    .value.map(m => m.providerId), ["vendor.b"]);
  assert.equal(core.uru.listProviders().length, 2);
  assert.equal(core.setServiceEnabled("PluginA", "vendor.a",
    "editor.highlight", true).status, 200);
  assert.equal(core.setProviderEnabled("PluginA", "vendor.a",
    false).status, 200);
  assert.equal(disposed, 1);
  assert.equal(core.materializeProvider("PluginA", "vendor.a").status,
    409);
  assert.equal(core.setProviderEnabled("PluginA", "vendor.a",
    true).status, 200);
  assert.equal(core.services.resolve("editor.highlight").value.length, 2);
  core.unregisterProvider("PluginA", "vendor.a");
  assert.equal(disposed, 1, "Unregister must not dispose twice");
  assert.equal(core.services.resolve("editor.highlight").value.length, 1);
});

test("PR03.08 rejects incompatible version and schema, no execution", () => {
  const core = new LinkCore();
  core.register(object("PluginA"));
  core.registerProvider("PluginA", manifest("PluginA", "vendor.a"));
  const expected = {
    service: "editor.highlight", version: "1.1.0",
    inputSchema: { type: "object" },
    outputSchema: { type: "array", items: { type: "string" } }
  };
  assert.equal(core.services.negotiate(expected).status, 200);
  assert.equal(core.services.negotiate({
    ...expected, version: "2.0.0"
  }).status, 409);
  assert.equal(core.services.negotiate({
    ...expected, outputSchema: { type: "string" }
  }).status, 409);
  assert.equal(core.services.negotiate({
    ...expected, outputSchema: { type: "invalid" }
  }).status, 409);
  assert.equal(core.getSnapshot().dependencies.length, 0);
});

test("PR03.09 health faults, EHU and cooldown do not erase Object", () => {
  const core = new LinkCore();
  core.register(object("PluginA"));
  core.registerProvider("PluginA", manifest("PluginA", "vendor.a"));
  const now = Date.now();
  assert.equal(core.reportProviderHealth("PluginA", "vendor.a",
    "failure", now).status, 200);
  core.reportProviderHealth("PluginA", "vendor.a", "timeout", now + 1);
  const third = core.reportProviderHealth("PluginA", "vendor.a",
    "failure", now + 2);
  assert.equal(third.value.state, "faulted");
  assert.equal(core.services.resolve("editor.highlight").status, 404);
  assert.equal(core.uru.objects.has("PluginA"), true);
  assert.equal(core.reportProviderHealth("PluginA", "vendor.a",
    "ok", now + 3).status, 429);
  assert.equal(core.reportProviderHealth("PluginA", "vendor.a",
    "ok", now + 30003).status, 200);
  assert.equal(core.services.resolve("editor.highlight").status, 200);
  assert.ok(core.getSnapshot().logs.some(event =>
    event.kind === "EHU" && event.action === "Provider.Health" &&
    event.status === 504));
});

test("PR03.10 real VTE cross-Object REQ/REP and 00/10/01/11", async () => {
  const env = new VirtualTestEnvironment();
  env.create("a");
  env.create("b");
  env.create("idle");
  assert.equal(env.core.uru.listProviders().length, 0);
  assert.equal(env.snapshot().dependencies.length, 0);
  const output = await env.act("a", "b", "ping", { n: 3 });
  assert.equal(output.status, 200);
  assert.equal(output.value.n, 3);
  const edges = env.snapshot().dependencies;
  assert.ok(edges.some(edge => edge.link === "VTE.a->VTE.b" &&
    edge.code === "10"));
  assert.ok(edges.some(edge => edge.link === "VTE.b->VTE.a" &&
    edge.code === "01"));
  assert.ok(env.log().some(event =>
    event.action === "Request.ping" && event.status === 200));
  assert.ok(env.log().some(event =>
    event.action === "Response.ping" && event.status === 200));
  assert.equal(edges.some(edge => edge.link.includes("VTE.idle")), false,
    "Unrelated Object remains 00");
  const reversed = await env.act("b", "a", "pong", { n: 4 });
  assert.equal(reversed.status, 200);
  const both = env.snapshot().dependencies;
  assert.ok(both.some(edge => edge.link === "VTE.a->VTE.b" &&
    edge.code === "11"));
  assert.ok(both.some(edge => edge.link === "VTE.b->VTE.a" &&
    edge.code === "11"));
});
