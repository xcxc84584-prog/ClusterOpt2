import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

const OBJECT = { type: "object" };
const STRING = { type: "string" };
function obj(id, handler, access = "Public") {
  return {
    id, authorization: { run: access },
    receive: async (_action, payload) => handler(payload),
    ocda: {
      Request: ["run"], Response: [], UserAPI: ["run"],
      AgentAPI: ["run"], Property: [], Program: {}, EHU: [], Log: []
    }
  };
}
function add(core, id, providerId, service, behavior,
  input = OBJECT, output = STRING) {
  assert.equal(core.register(obj(id, behavior)), true);
  assert.equal(core.registerProvider(id, {
    manifestVersion: 1, providerId, objectId: id,
    provides: [{ service, action: "run",
      version: "1.0.0", inputSchema: input,
      outputSchema: output }],
    requires: [], permissions: [],
    execution: { isolation: "host", concurrency: "parallel" }
  }).status, 201);
}
function route(service, providers, source, overrides = {}) {
  return {
    routeId: service, service, action: "run", mode: "replace",
    providers, sourceFilter: {
      origins: ["user", "agent"], objects: [source]
    },
    priority: 0, timeoutMs: 3000, ...overrides
  };
}
function table(routes) { return { schemaVersion: 1, routes }; }
const call = (core, source, service) =>
  core.requestService(source, service, "run",
    { text: "x" }, { origin: "user" });

test("PR04.08 scoped owner config cannot hijack another caller",
  async () => {
    const core = new LinkCore();
    add(core, "Owner", "vendor.own", "test.owned",
      payload => "owned:" + payload.text);
    core.register(obj("Other", () => "other"));
    const bad = route("test.owned", ["vendor.own"], "Other");
    assert.equal(core.configureOwnedRoutes("Owner",
      table([bad])).status, 403);
    assert.equal(core.hub.replaceRoutes.length, 0);
    assert.equal(core.configureOwnedRoutes("Owner",
      table([route("test.owned", ["vendor.own"], "Owner")]))
      .status, 200);
    assert.equal((await call(core, "Owner",
      "test.owned")).value, "owned:x");
  });

test("PR04.08 scoped owner cannot configure foreign Provider",
  async () => {
    const core = new LinkCore();
    add(core, "Owner", "vendor.own", "test.owned", x => x.text);
    add(core, "Foreign", "vendor.foreign",
      "test.owned", x => x.text);
    assert.equal(core.configureOwnedRoutes("Owner", table([
      route("test.owned", ["vendor.foreign"], "Owner")
    ])).status, 403);
    assert.equal(core.configureOwnedRoutes("Missing", table([]))
      .status, 404);
    assert.equal(core.hub.replaceRoutes.length, 0);
    assert.ok(core.getSnapshot().logs.some(item =>
      item.kind === "EHU" &&
      item.action === "Service.Route.OwnedConfigure"));
  });

test("PR04.08 changes only caller-scoped routes, keeps others",
  async () => {
    const core = new LinkCore();
    add(core, "Alpha", "vendor.alpha", "test.alpha", x => x.text);
    add(core, "Beta", "vendor.beta", "test.beta", x => x.text);
    assert.equal(core.configureOwnedRoutes("Alpha", table([
      route("test.alpha", ["vendor.alpha"], "Alpha")
    ])).status, 200);
    assert.equal(core.configureOwnedRoutes("Beta", table([
      route("test.beta", ["vendor.beta"], "Beta")
    ])).status, 200);
    assert.equal(core.hub.replaceRoutes.length, 2);
    assert.equal((await call(core, "Alpha", "test.alpha"))
      .value, "x");
    assert.equal((await call(core, "Beta", "test.beta"))
      .value, "x");
    assert.equal(core.configureOwnedRoutes("Alpha",
      table([])).status, 200);
    assert.equal(core.hub.replaceRoutes.length, 1);
    assert.equal((await call(core, "Beta", "test.beta"))
      .status, 200);
  });

test("PR04.08 route dependency cycles reject entire update",
  async () => {
    const core = new LinkCore();
    add(core, "A", "vendor.a", "test.cycle", x => x,
      STRING, STRING);
    add(core, "B", "vendor.b", "test.cycle", x => x,
      STRING, STRING);
    const good = route("test.cycle", ["vendor.a"], "A");
    assert.equal(core.configureServiceRoutes(
      table([good])).status, 200);
    const cyclic = {
      ...good, mode: "chain",
      providers: ["vendor.a", "vendor.b"],
      responsePipeline: [{
        kind: "transform", providerId: "vendor.a"
      }]
    };
    assert.equal(core.configureServiceRoutes(
      table([cyclic])).status, 409);
    assert.equal(core.hub.replaceRoutes.length, 1);
    assert.equal(core.hub.replaceRoutes[0].mode, "replace");
    assert.ok(core.getSnapshot().logs.some(item =>
      item.kind === "EHU" &&
      item.action === "Service.Route.Configure" &&
      item.status === 409));
  });

test("PR04.08 does not expose host route mutation to browser API",
  () => {
    const core = new LinkCore();
    const vte = new VirtualTestEnvironment();
    assert.equal(typeof core.configureOwnedRoutes, "function");
    assert.equal(typeof vte.core.configureOwnedRoutes, "function");
    assert.equal(Object.hasOwn(core.api ?? {},
      "configureOwnedRoutes"), false);
    assert.equal(core.hub.replaceRoutes.length, 0);
  });
