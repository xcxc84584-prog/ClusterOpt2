import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";

const empty = () => ({ schemaVersion: 1, routes: [] });

test("PR05.01 immutable snapshot and monotonically increasing generation",
  () => {
    const core = new LinkCore();
    const first = core.routeSnapshot();
    assert.equal(first.generation, 0);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.routes));
    assert.equal(core.configureServiceRoutes(empty()).status, 200);
    const second = core.routeSnapshot();
    assert.equal(second.generation, 1);
    assert.notStrictEqual(first.routes, second.routes);
    assert.equal(first.generation, 0);
    assert.equal(first.routes.length, 0);
  });

test("PR05.02 validate is non-mutating; commit requires validation",
  () => {
    const core = new LinkCore();
    const started = core.beginRouteTransaction(empty());
    assert.equal(started.status, 201);
    const id = started.value.transactionId;
    assert.equal(core.commitRouteTransaction(id).status, 412);
    assert.equal(core.validateRouteTransaction(id).status, 200);
    assert.equal(core.routeSnapshot().generation, 0);
    assert.equal(core.commitRouteTransaction(id).status, 200);
    assert.equal(core.routeSnapshot().generation, 1);
    assert.equal(core.commitRouteTransaction(id).status, 404);
  });

test("PR05.03 CAS detects concurrent host configuration", () => {
    const core = new LinkCore();
    const started = core.beginRouteTransaction(empty());
    const id = started.value.transactionId;
    assert.equal(core.validateRouteTransaction(id).status, 200);
    assert.equal(core.configureServiceRoutes(empty()).status, 200);
    assert.equal(core.commitRouteTransaction(id).status, 409);
    assert.equal(core.routeSnapshot().generation, 1);
    assert.ok(core.getSnapshot().logs.some(event =>
      event.kind === "EHU" &&
      event.action === "Service.Route.Transaction.Commit" &&
      event.status === 409));
  });

test("PR05.02 rejects invalid table, abort and exhausted slots", () => {
    const core = new LinkCore();
    assert.equal(core.beginRouteTransaction({ schemaVersion: 9,
      routes: [] }).status, 400);
    const handles = Array.from({ length: 16 }, () =>
      core.beginRouteTransaction(empty()));
    assert.ok(handles.every(x => x.status === 201));
    assert.equal(core.beginRouteTransaction(empty()).status, 429);
    assert.equal(core.abortRouteTransaction(
      handles[0].value.transactionId).status, 200);
    assert.equal(core.abortRouteTransaction(
      handles[0].value.transactionId).status, 404);
    assert.equal(core.beginRouteTransaction(empty()).status, 201);
  });

test("PR05 transaction API is not exposed through browser routes",
  () => {
    const core = new LinkCore();
    assert.equal(typeof core.beginRouteTransaction, "function");
    assert.equal(typeof core.configureOwnedRoutes, "function");
    assert.equal(core.inspectRoutes("Ghost", "list", {}).status, 404);
  });
