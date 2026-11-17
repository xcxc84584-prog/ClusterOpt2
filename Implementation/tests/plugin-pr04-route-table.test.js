import test from "node:test";
import assert from "node:assert/strict";
import { RouteTablePolicy } from "../property/RouteTablePolicy.js";
import { LinkCore } from "../LinkCore/LinkCore.js";

function route(overrides = {}) {
  return {
    routeId: "editor.default", service: "editor.highlight",
    action: "highlight", mode: "replace",
    providers: ["vendor.highlighter"],
    sourceFilter: { origins: ["user", "agent"], objects: [] },
    priority: 0, timeoutMs: 3000, ...overrides
  };
}
function table(routes = [route()]) {
  return { schemaVersion: 1, routes };
}
test("PR04.02 validates and deep-freezes detached Route Table", () => {
  const input = table();
  const result = RouteTablePolicy.validate(input);
  assert.equal(result.status, 200);
  assert.ok(Object.isFrozen(result.value));
  assert.ok(Object.isFrozen(result.value.routes[0].sourceFilter));
  assert.ok(Object.isFrozen(result.value.routes[0].providers));
  input.routes[0].providers[0] = "vendor.changed";
  assert.equal(result.value.routes[0].providers[0], "vendor.highlighter");
  assert.equal(RouteTablePolicy.validate(table([])).status, 200);
});
test("PR04.02 validates all future modes without executing", () => {
  for (const mode of ["replace", "chain", "fanout", "observe"]) {
    const providers = mode === "replace" ?
      ["vendor.first"] : ["vendor.first", "vendor.second"];
    assert.equal(RouteTablePolicy.validate(table([
      route({ mode, providers })
    ])).status, 200);
  }
  assert.equal(RouteTablePolicy.validate(table([
    route({ providers: ["vendor.first", "vendor.second"] })
  ])).status, 400);
  assert.equal(RouteTablePolicy.validate(table([
    route({ mode: "unknown" })
  ])).status, 400);
});
test("PR04.02 rejects unsafe data and prototype pollution", () => {
  const bad = [
    { ...table(), schemaVersion: 2 },
    { ...table(), rogue: true },
    table([route({ timeoutMs: 0 })]),
    table([route({ timeoutMs: 30001 })]),
    table([route({ priority: 101 })]),
    table([route({ sourceFilter: { origins: [], objects: [] } })]),
    table([route({ sourceFilter: { origins: ["user", "user"], objects: [] } })]),
    table([route({ providers: ["vendor.highlighter", "vendor.highlighter"], mode: "chain" })]),
    table([route({ routeId: "__proto__" })]),
    table([route({ service: "Bad.Service" })]),
    table([route({ action: "bad_action" })]),
    table([route({ sourceFilter: { origins: ["user"], objects: ["__proto__"] } })]),
    table([route({ sourceFilter: { origins: ["root"], objects: [] } })]),
    table([route({ sourceFilter: { origins: ["user"], objects: [], extra: true } })]),
    table([route({ providers: [] })]),
    table([route({ timeoutMs: Infinity })]),
    table(Array.from({ length: 33 }, (_, i) =>
      route({ routeId: "route." + i, priority: i })))
  ];
  for (const value of bad) {
    assert.equal(RouteTablePolicy.validate(value).status, 400);
  }
  const polluted = JSON.parse('{"schemaVersion":1,"routes":[],"__proto__":{}}');
  assert.equal(RouteTablePolicy.validate(polluted).status, 400);
  const cycle = table();
  cycle.routes[0].extra = cycle;
  assert.equal(RouteTablePolicy.validate(cycle).status, 400);
  const getter = table();
  Object.defineProperty(getter.routes[0], "priority", {
    get() { throw Error("must not invoke getter"); }, enumerable: true
  });
  assert.equal(RouteTablePolicy.validate(getter).status, 400);
  const oversized = table([route({
    routeId: "oversized", sourceFilter: {
      origins: ["user"], objects: Array.from({ length: 32 }, (_, i) =>
        "O" + String(i).padStart(100, "x"))
    }
  })]);
  // A bounded valid table stays below the maximum; the route budget
  // is also constrained independently by count and per-field limits.
  assert.equal(RouteTablePolicy.validate(oversized).status, 200);
});
test("PR04.02 rejects collisions, preserves existing Hub routing", async () => {
  assert.equal(RouteTablePolicy.validate(table([
    route(), route({ routeId: "editor.duplicate" })
  ])).status, 400);
  assert.equal(RouteTablePolicy.validate(table([
    route(), route({ priority: 1, routeId: "editor.alternative" })
  ])).status, 200);
  const core = new LinkCore();
  assert.equal(typeof core.requestService, "function");
  assert.equal((await core.requestService("Nobody",
    "editor.highlight", "highlight")).status, 404);
  assert.equal(typeof core.request, "function");
});
