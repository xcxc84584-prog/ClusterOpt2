import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

const service = "test.observe";
const declaration = (id, providerId, output = { type: "string" }) => ({
  manifestVersion: 1, providerId, objectId: id,
  provides: [{ service, action: "run", version: "1.0.0",
    inputSchema: { type: "object" }, outputSchema: output }],
  requires: [], permissions: [],
  execution: { isolation: "host", concurrency: "parallel" }
});
const route = (providers) => ({
  routeId: "test.observe", service, action: "run",
  mode: "observe", providers,
  sourceFilter: { origins: ["user", "agent"], objects: [] },
  priority: 0, timeoutMs: 3000
});
function add(core, id, handler, access = "Public") {
  core.register({
    id, authorization: { run: access },
    receive: async (_action, input) => handler(input),
    ocda: { Request: ["run"], Response: [],
      UserAPI: ["run"], AgentAPI: ["run"], Property: [],
      Program: {}, EHU: [], Log: [] }
  });
}
function setup(primary, observer, observerAccess = "Public") {
  const core = new LinkCore();
  add(core, "Caller", () => "caller");
  add(core, "Primary", primary);
  add(core, "Observer", observer, observerAccess);
  assert.equal(core.registerProvider("Primary",
    declaration("Primary", "vendor.primary")).status, 201);
  assert.equal(core.registerProvider("Observer",
    declaration("Observer", "vendor.observe")).status, 201);
  assert.equal(core.configureServiceRoutes({ schemaVersion: 1,
    routes: [route(["vendor.primary", "vendor.observe"])] }).status, 200);
  return core;
}
function flush() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

test("PR04.06 sends only masked metadata and retains primary result",
  async () => {
    let observed;
    const core = setup(input => "secret-result:" + input.secret,
      input => { observed = input; return "ok"; });
    const result = await core.requestService("Caller", service, "run",
      { secret: "private-input" }, { origin: "user" });
    assert.equal(result.value, "secret-result:private-input");
    await flush();
    assert.deepEqual(observed, { service, action: "run",
      status: 200, ok: true });
    assert.equal(JSON.stringify(observed).includes("secret"), false);
    assert.ok(Object.isFrozen(observed));
    assert.ok(core.getSnapshot().dependencies.some(item =>
      item.link === "Caller->Observer" && item.code === "10"));
  });

test("PR04.06 observer rejection cannot replace primary success",
  async () => {
    const core = setup(() => "safe", () => "ignored", "Private");
    const result = await core.requestService("Caller", service, "run",
      {}, { origin: "user" });
    assert.equal(result.value, "safe");
    await flush();
    assert.ok(core.getSnapshot().logs.some(item =>
      item.kind === "EHU" && item.action === "Service.Route.Observe" &&
      item.status === 403));
  });

test("PR04.06 observer exceptions do not propagate or leak",
  async () => {
    const core = setup(() => "safe", () => {
      throw new Error("observer secret");
    });
    const result = await core.requestService("Caller", service, "run",
      {}, { origin: "user" });
    assert.equal(result.value, "safe");
    await flush();
    assert.ok(core.getSnapshot().logs.some(item =>
      item.action === "Service.Route.Observe" && item.kind === "EHU"));
  });

test("PR04.06 failed primary never calls observer", async () => {
  let seen = 0;
  const core = setup(() => { throw new Error("failed"); },
    () => { seen++; return "ok"; });
  const result = await core.requestService("Caller", service, "run",
    {}, { origin: "user" });
  assert.equal(result.status, 500);
  await flush();
  assert.equal(seen, 0);
});

test("PR04.06 invalid observe config is atomic and VTE isolated",
  async () => {
    const env = new VirtualTestEnvironment();
    assert.equal(env.core.configureServiceRoutes({
      schemaVersion: 1, routes: [route(["vendor.primary"])]
    }).status, 400);
    assert.equal(new LinkCore().hub.replaceRoutes.length, 0);
    assert.equal(typeof env.core.request, "function");
  });
