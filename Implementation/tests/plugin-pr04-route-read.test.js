import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";
import { createRouteReadFacade } from
  "../LinkCore/RouteReadFacade.js";

const OBJ = { type: "object" };
const STR = { type: "string" };
function receiver(id, behavior, privateRun = false) {
  return {
    id, authorization: { run: privateRun ? "Private" : "Public" },
    receive: async (_action, input) => behavior(input),
    ocda: { Request: ["run"], Response: [],
      UserAPI: ["run"], AgentAPI: [], Property: [],
      Program: {}, EHU: [], Log: [] }
  };
}
function provide(core, id, key, privateRun = false) {
  core.register(receiver(id, x => x.text, privateRun));
  assert.equal(core.registerProvider(id, {
    manifestVersion: 1, providerId: key, objectId: id,
    provides: [{ service: "test.routes", action: "run",
      version: "1.0.0", inputSchema: OBJ, outputSchema: STR }],
    requires: [], permissions: [],
    execution: { isolation: "host", concurrency: "parallel" }
  }).status, 201);
}
function route(providerId, origin = ["user"], scope = ["Caller"]) {
  return { routeId: "test.route", service: "test.routes",
    action: "run", mode: "replace", providers: [providerId],
    sourceFilter: { origins: origin, objects: scope },
    priority: 0, timeoutMs: 3000 };
}
const table = routes => ({ schemaVersion: 1, routes });

test("PR04.09 list and describe return detached scoped metadata",
  () => {
    const core = new LinkCore();
    provide(core, "Caller", "vendor.caller");
    assert.equal(core.configureServiceRoutes(table([
      route("vendor.caller")
    ])).status, 200);
    const list = core.inspectRoutes("Caller", "list", {});
    assert.equal(list.status, 200);
    assert.equal(list.value.total, 1);
    assert.deepEqual(list.value.routes.map(x => x.routeId),
      ["test.route"]);
    assert.equal(Object.isFrozen(list.value.routes), true);
    assert.equal(core.inspectRoutes("Caller", "describe",
      "test.route").value.mode, "replace");
    assert.equal(core.inspectRoutes("Caller", "describe",
      "another.route").status, 404);
  });

test("PR04.09 hides host-owned or foreign Provider routes", () => {
  const core = new LinkCore();
  core.register(receiver("Caller", () => "caller"));
  provide(core, "Other", "vendor.other");
  assert.equal(core.configureServiceRoutes(table([
    route("vendor.other")
  ])).status, 200);
  assert.equal(core.inspectRoutes("Caller", "list", {})
    .value.total, 0);
  assert.equal(core.inspectRoutes("Caller", "describe",
    "test.route").status, 404);
  assert.equal(core.inspectRoutes("Caller", "preview", {
    service: "test.routes", action: "run"
  }).status, 200);
});

test("PR04.09 preview checks ACL but does not dispatch", () => {
  const core = new LinkCore();
  let executions = 0;
  core.register(receiver("Caller", () => "caller"));
  core.register(receiver("Other", () => {
    executions++;
    return "no";
  }, true));
  assert.equal(core.registerProvider("Other", {
    manifestVersion: 1, providerId: "vendor.other",
    objectId: "Other",
    provides: [{ service: "test.routes", action: "run",
      version: "1.0.0", inputSchema: OBJ, outputSchema: STR }],
    requires: [], permissions: [],
    execution: { isolation: "host", concurrency: "parallel" }
  }).status, 201);
  assert.equal(core.configureServiceRoutes(table([
    route("vendor.other")
  ])).status, 200);
  const before = core.getSnapshot().dependencies;
  assert.equal(core.inspectRoutes("Caller", "preview", {
    service: "test.routes", action: "run"
  }).status, 403);
  assert.equal(executions, 0);
  assert.deepEqual(core.getSnapshot().dependencies, before);
  assert.ok(core.getSnapshot().logs.some(event =>
    event.kind === "EHU" &&
    event.action === "Service.Route.preview" &&
    event.status === 403));
});

test("PR04.09 rejects malformed selectors and unknown senders",
  () => {
    const core = new LinkCore();
    core.register(receiver("Caller", () => "caller"));
    assert.equal(core.inspectRoutes("Ghost", "list", {})
      .status, 404);
    for (const input of [
      { limit: 100 }, { offset: -1 }, { rogue: true },
      Object.defineProperty({}, "limit", {
        enumerable: true, get() { throw Error("accessor"); }
      })
    ]) {
      assert.equal(core.inspectRoutes("Caller", "list", input)
        .status, 400);
    }
    assert.equal(core.inspectRoutes("Caller", "preview", {
      service: "bad", action: "run"
    }).status, 400);
    assert.equal(core.inspectRoutes("Caller", "list", {},
      "spoof").status, 400);
  });

test("PR04.09 browser facade pins user/UI, VTE is isolated",
  () => {
    const core = new LinkCore();
    core.register(receiver("ui", () => "ui"));
    const api = createRouteReadFacade(core);
    assert.deepEqual(Object.keys(api).sort(),
      ["describe", "list", "preview"]);
    assert.equal(Object.isFrozen(api), true);
    assert.equal(api.list().status, 200);
    assert.equal(api.preview("test.routes", "run").status, 404);
    assert.equal(typeof api.configure, "undefined");
    const env = new VirtualTestEnvironment();
    assert.equal(env.core.hub.replaceRoutes.length, 0);
    assert.equal(env.core.inspectRoutes("VTE", "list", {})
      .value.total, 0);
  });
