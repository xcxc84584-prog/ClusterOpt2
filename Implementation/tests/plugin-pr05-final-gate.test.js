import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { ReleaseVersion } from "../property/ReleaseVersion.js";

const table = () => ({ schemaVersion: 1, routes: [] });

test("PR05.10 concurrent candidate CAS allows one winner", () => {
  const core = new LinkCore();
  const ids = Array.from({ length: 12 }, () => {
    const started = core.beginRouteTransaction(table());
    assert.equal(started.status, 201);
    assert.equal(core.validateRouteTransaction(
      started.value.transactionId).status, 200);
    return started.value.transactionId;
  });
  const commits = ids.map(id => core.commitRouteTransaction(id));
  assert.equal(commits.filter(x => x.status === 200).length, 1);
  assert.equal(commits.filter(x => x.status === 409).length, 11);
  assert.equal(core.routeSnapshot().generation, 1);
  assert.ok(core.getSnapshot().logs.some(x => x.kind === "EHU" &&
    x.action === "Service.Route.Transaction.Commit" &&
    x.status === 409));
});

test("PR05.10 rejected candidate does not replace live routing", () => {
  const core = new LinkCore();
  const before = core.routeSnapshot();
  const invalid = { schemaVersion: 1, routes: [{
    routeId: "test.invalid", service: "test.unavailable",
    action: "run", mode: "replace", providers: ["vendor.missing"],
    sourceFilter: { origins: ["user"], objects: [] },
    priority: 0, timeoutMs: 1000
  }] };
  const started = core.beginRouteTransaction(invalid);
  assert.equal(started.status, 201);
  assert.equal(core.validateRouteTransaction(
    started.value.transactionId).status, 404);
  assert.equal(core.commitRouteTransaction(
    started.value.transactionId).status, 412);
  assert.deepEqual(core.routeSnapshot(), before);
});

test("PR05.10 unified version follows ReleaseVersion authority", () => {
  const core = new LinkCore();
  assert.match(ReleaseVersion.product, /^0\.0\.\d+[a-z]?$/u);
  assert.equal(core.version, ReleaseVersion.product);
  assert.equal(core.routeSnapshot().generation, 0);
});
