import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

const OBJ = { type: "object" };
const STR = { type: "string" };
function object(id, behavior, access = "Public", agent = true) {
  return {
    id, authorization: { run: access },
    receive: async (action, payload) => behavior(payload),
    ocda: {
      Request: ["run"], Response: [],
      UserAPI: ["run"], AgentAPI: agent ? ["run"] : [],
      Property: [], Program: {}, EHU: [], Log: []
    }
  };
}
function manifest(id, name, input = OBJ, output = STR) {
  return {
    manifestVersion: 1, providerId: name, objectId: id,
    provides: [{ service: "test.pipeline", action: "run",
      version: "1.0.0", inputSchema: input,
      outputSchema: output }],
    requires: [], permissions: [],
    execution: { isolation: "host", concurrency: "parallel" }
  };
}
function route(mode, providers) {
  return {
    routeId: "test.pipeline", service: "test.pipeline",
    action: "run", mode, providers,
    sourceFilter: { origins: ["user", "agent"], objects: [] },
    priority: 0, timeoutMs: 3000
  };
}
function setup() {
  const core = new LinkCore();
  core.register(object("Caller", x => x));
  return core;
}
function add(core, id, name, behavior, input = OBJ,
  output = STR, access = "Public", agent = true) {
  core.register(object(id, behavior, access, agent));
  assert.equal(core.registerProvider(id,
    manifest(id, name, input, output)).status, 201);
}
function configure(core, mode, providers) {
  return core.configureServiceRoutes({
    schemaVersion: 1, routes: [route(mode, providers)]
  });
}
test("PR04.04 Chain uses validated output as next stage input",
  async () => {
    const core = setup();
    add(core, "A", "vendor.a", input => input.text, OBJ, STR);
    add(core, "B", "vendor.b", input => input + "!", STR, STR);
    assert.equal(configure(core, "chain",
      ["vendor.a", "vendor.b"]).status, 200);
    const result = await core.requestService("Caller",
      "test.pipeline", "run", { text: "hello" },
      { origin: "user" });
    assert.equal(result.value, "hello!");
    const deps = core.getSnapshot().dependencies;
    for (const id of ["A", "B"]) {
      assert.ok(deps.some(item =>
        item.link === "Caller->" + id && item.code === "10"));
      assert.ok(deps.some(item =>
        item.link === id + "->Caller" && item.code === "01"));
    }
  });
test("PR04.04 rejects incompatible chain without changing old route",
  async () => {
    const core = setup();
    add(core, "A", "vendor.a", input => input.text, OBJ, STR);
    add(core, "B", "vendor.b", input => input, OBJ, STR);
    assert.equal(configure(core, "replace",
      ["vendor.a"]).status, 200);
    assert.equal(configure(core, "chain",
      ["vendor.a", "vendor.b"]).status, 409);
    const result = await core.requestService("Caller",
      "test.pipeline", "run", { text: "ok" },
      { origin: "user" });
    assert.equal(result.value, "ok");
  });
test("PR04.04 invalid Provider output stops later execution",
  async () => {
    const core = setup();
    let calls = 0;
    add(core, "A", "vendor.a", () => 2, OBJ, STR);
    add(core, "B", "vendor.b", input => {
      calls++;
      return input;
    }, STR, STR);
    assert.equal(configure(core, "chain",
      ["vendor.a", "vendor.b"]).status, 200);
    const result = await core.requestService("Caller",
      "test.pipeline", "run", { text: "ok" },
      { origin: "user" });
    assert.equal(result.status, 502);
    assert.equal(calls, 0);
    assert.ok(core.getSnapshot().logs.some(item =>
      item.kind === "EHU" &&
      item.action === "Service.Route.Execute"));
  });
test("PR04.05 Fanout runs branches and aggregates in declared order",
  async () => {
    const core = setup();
    add(core, "A", "vendor.a", async x => {
      await Promise.resolve();
      return "slow:" + x.text;
    });
    add(core, "B", "vendor.b", async x => "fast:" + x.text);
    assert.equal(configure(core, "fanout",
      ["vendor.a", "vendor.b"]).status, 200);
    const result = await core.requestService("Caller",
      "test.pipeline", "run", { text: "x" },
      { origin: "user" });
    assert.equal(result.status, 200);
    assert.deepEqual(result.value, [
      { providerId: "vendor.a", value: "slow:x" },
      { providerId: "vendor.b", value: "fast:x" }
    ]);
    assert.ok(Object.isFrozen(result.value));
  });
test("PR04.05 Fanout fails closed and records EHU",
  async () => {
    const core = setup();
    add(core, "A", "vendor.a", () => "ok");
    add(core, "B", "vendor.b", () => 42);
    assert.equal(configure(core, "fanout",
      ["vendor.a", "vendor.b"]).status, 200);
    const result = await core.requestService("Caller",
      "test.pipeline", "run", { text: "x" },
      { origin: "user" });
    assert.equal(result.status, 502);
    assert.ok(!Object.hasOwn(result, "value"));
    assert.ok(core.getSnapshot().logs.some(item =>
      item.kind === "EHU" &&
      item.action === "Service.Route.Execute"));
  });
test("PR04.04/05 runtime still checks ACL and Provider availability",
  async () => {
    const core = setup();
    add(core, "A", "vendor.a", () => "ok");
    add(core, "B", "vendor.b", () => "private",
      OBJ, STR, "Private", false);
    assert.equal(configure(core, "fanout",
      ["vendor.a", "vendor.b"]).status, 200);
    const result = await core.requestService("Caller",
      "test.pipeline", "run", { text: "x" },
      { origin: "user" });
    assert.equal(result.status, 403);
    assert.equal(core.getSnapshot().dependencies.some(item =>
      item.link === "B->Caller"), false);
    core.setProviderEnabled("B", "vendor.b", false);
    assert.equal((await core.requestService("Caller",
      "test.pipeline", "run", { text: "x" },
      { origin: "user" })).status, 404);
  });
test("PR04.04/05 configuration is private and VTE-isolated",
  async () => {
    const vte = new VirtualTestEnvironment();
    assert.equal(typeof vte.core.configureServiceRoutes, "function");
    assert.equal(new LinkCore().hub.replaceRoutes.length, 0);
    assert.equal(vte.core.configureServiceRoutes({
      schemaVersion: 1, routes: [{
        ...route("observe", ["vendor.a"])
      }]
    }).status, 400);
    assert.equal(typeof vte.core.request, "function");
  });
