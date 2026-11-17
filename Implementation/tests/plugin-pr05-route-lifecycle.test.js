import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { createRouteReadFacade } from "../LinkCore/RouteReadFacade.js";

const table = routes => ({ schemaVersion: 1, routes });
const OBJ = { type: "object" };
const STR = { type: "string" };

function register(core, id, receive) {
  core.register({
    id, authorization: { run: "Public" },
    receive, ocda: {
      Request: ["run"], Response: [], UserAPI: ["run"],
      AgentAPI: [], Property: [], Program: {}, EHU: [], Log: []
    }
  });
  const result = core.registerProvider(id, {
    manifestVersion: 1, providerId: "test." + id.toLowerCase(),
    objectId: id, provides: [{ service: "test.transactions",
      action: "run", version: "1.0.0",
      inputSchema: OBJ, outputSchema: STR }],
    requires: [], permissions: [],
    execution: { isolation: "host", concurrency: "parallel" }
  });
  assert.equal(result.status, 201);
}

function route(id) {
  return { routeId: "test.transaction.route",
    service: "test.transactions", action: "run", mode: "replace",
    providers: ["test." + id.toLowerCase()],
    sourceFilter: { origins: ["user"], objects: ["Caller"] },
    priority: 0, timeoutMs: 3000 };
}

test("PR05.04 inflight request retains its provider and generation",
  async () => {
    const core = new LinkCore();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    register(core, "Caller", async () => "caller");
    register(core, "Provider", async () => {
      await gate;
      return "previous";
    });
    assert.equal(core.configureServiceRoutes(
      table([route("Provider")])).status, 200);
    const oldVersion = core.routeSnapshot().generation;
    const ongoing = core.requestService("Caller", "test.transactions",
      "run", {}, { origin: "user" });
    assert.equal(core.configureServiceRoutes(table([])).status, 200);
    let drained = false;
    const waiting = core.awaitRouteDrain(oldVersion).then(x => {
      drained = x.ok;
    });
    await Promise.resolve();
    assert.equal(drained, false);
    release();
    const result = await ongoing;
    await waiting;
    assert.equal(result.status, 200);
    assert.equal(result.value, "previous");
    assert.equal(drained, true);
    assert.ok(core.getSnapshot().logs.some(x =>
      x.action === "Service.Resolve" &&
      x.details?.routeVersion === oldVersion));
  });

test("PR05.06 missing Provider remains fail-closed", async () => {
    const core = new LinkCore();
    register(core, "Caller", async () => "caller");
    register(core, "Provider", async () => "provider");
    assert.equal(core.configureServiceRoutes(
      table([route("Provider")])).status, 200);
    assert.equal(core.setProviderEnabled(
      "Provider", "test.provider", false).status, 200);
    const result = await core.requestService(
      "Caller", "test.transactions", "run", {},
      { origin: "user" });
    assert.equal(result.status, 404);
    assert.equal(result.ok, false);
  });

test("PR05.07 rollback revalidates with CAS and increments generation",
  () => {
    const core = new LinkCore();
    const first = core.routeSnapshot();
    assert.equal(core.configureServiceRoutes(table([])).status, 200);
    assert.equal(core.rollbackRouteGeneration(
      first.generation, 0).status, 409);
    const accepted = core.rollbackRouteGeneration(first.generation, 1);
    assert.equal(accepted.status, 200);
    assert.equal(core.routeSnapshot().generation, 2);
    assert.equal(core.rollbackRouteGeneration(99, 2).status, 404);
    assert.ok(core.getSnapshot().logs.some(x =>
      x.action === "Service.Route.Rollback" && x.status === 409));
  });

test("PR05.08 restart clears runtime registrations and stale transactions",
  () => {
    const core = new LinkCore();
    const tx = core.beginRouteTransaction(table([]));
    assert.equal(tx.status, 201);
    const restarted = new LinkCore();
    assert.equal(restarted.routeSnapshot().generation, 0);
    assert.equal(restarted.commitRouteTransaction(
      tx.value.transactionId).status, 404);
    assert.equal(createRouteReadFacade(restarted).list().status, 404);
  });

test("PR05.09/10 bounded history and stale candidate concurrency",
  async () => {
    const core = new LinkCore();
    const tx = core.beginRouteTransaction(table([]));
    assert.equal(core.validateRouteTransaction(
      tx.value.transactionId).status, 200);
    for (let i = 0; i < 12; i++) {
      assert.equal(core.configureServiceRoutes(table([])).status, 200);
    }
    assert.equal(core.commitRouteTransaction(
      tx.value.transactionId).status, 409);
    assert.equal(core.rollbackRouteGeneration(0, 12).status, 404);
    assert.equal(core.rollbackRouteGeneration(11, 12).status, 200);
    assert.equal((await core.awaitRouteDrain(12)).status, 200);
    assert.equal((await core.awaitRouteDrain(-1)).status, 400);
  });
