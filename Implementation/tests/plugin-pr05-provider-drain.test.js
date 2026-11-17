import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";

const OBJ = { type: "object" };
const STR = { type: "string" };
const table = routes => ({ schemaVersion: 1, routes });
function register(core, id, receive) {
  core.register({
    id, authorization: { run: "Public" },
    receive, ocda: {
      Request: ["run"], Response: [], UserAPI: ["run"],
      AgentAPI: [], Property: [], Program: {}, EHU: [], Log: []
    }
  });
  assert.equal(core.registerProvider(id, {
    manifestVersion: 1, providerId: "test." + id.toLowerCase(),
    objectId: id, provides: [{
      service: "test.draining", action: "run", version: "1.0.0",
      inputSchema: OBJ, outputSchema: STR
    }],
    requires: [], permissions: [],
    execution: { isolation: "host", concurrency: "parallel" }
  }).status, 201);
}
function route() {
  return { routeId: "test.draining.route", service: "test.draining",
    action: "run", mode: "replace",
    providers: ["test.provider"], sourceFilter: {
      origins: ["user"], objects: ["Caller"]
    }, priority: 0, timeoutMs: 3000 };
}

test("PR05.05 drain disables new provider work but completes inflight",
  async () => {
    const core = new LinkCore();
    let unblock;
    let started;
    const running = new Promise(resolve => { started = resolve; });
    const gate = new Promise(resolve => { unblock = resolve; });
    register(core, "Caller", async () => "caller");
    register(core, "Provider", async () => {
      started();
      await gate;
      return "complete";
    });
    assert.equal(core.configureServiceRoutes(
      table([route()])).status, 200);
    const prior = core.requestService("Caller", "test.draining",
      "run", {}, { origin: "user" });
    await running;
    assert.equal(core.unregisterProvider(
      "Provider", "test.provider").status, 409);
    assert.equal(core.unregister("Provider"), false);
    const draining = core.drainProvider("Provider", "test.provider");
    const blocked = await core.requestService("Caller",
      "test.draining", "run", {}, { origin: "user" });
    assert.equal(blocked.status, 404);
    unblock();
    const result = await prior;
    assert.equal(result.ok, true);
    assert.equal(result.value, "complete");
    const retired = await draining;
    assert.equal(retired.status, 200);
    assert.equal(core.uru.getProvider("test.provider"), undefined);
  });

test("PR05.08 host rehydrate uses candidate validate and CAS",
  () => {
    const core = new LinkCore();
    assert.equal(core.restoreRouteConfiguration(table([])).status, 200);
    assert.equal(core.routeSnapshot().generation, 1);
    const next = new LinkCore();
    assert.equal(next.routeSnapshot().generation, 0);
    assert.equal(next.restoreRouteConfiguration(
      { schemaVersion: 999, routes: [] }).status, 400);
    assert.equal(next.routeSnapshot().generation, 0);
  });

test("PR05.05 refuses impersonated drain", async () => {
  const core = new LinkCore();
  register(core, "Caller", async () => "caller");
  register(core, "Provider", async () => "provider");
  assert.equal((await core.drainProvider(
    "Caller", "test.provider")).status, 403);
  assert.equal((await core.drainProvider(
    "Ghost", "test.provider")).status, 404);
});
