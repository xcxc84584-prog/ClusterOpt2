import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";

function register(core, owner, id) {
  return core.register({
    id: owner, strictOCDA: true,
    receive: async () => "executed",
    ocda: {
      Request: ["run"], Response: ["run"],
      UserAPI: ["run"], AgentAPI: [], Property: [],
      Program: "Test", EHU: "LinkCore.OMU", Log: "LinkCore.OMU",
      APIDescriptors: [{
        apiVersion: 1, id, owner, action: "run",
        version: "1.0.0", visibility: "Public", sideEffect: "none",
        inputSchema: { type: "object" }, outputSchema: { type: "object" }
      }]
    }
  });
}

test("PR02.05 internal list, describe and deterministic pagination", () => {
  const core = new LinkCore();
  assert.equal(register(core, "Plugin.B", "same.run"), true);
  assert.equal(register(core, "Plugin.A", "same.run"), true);
  assert.equal(register(core, "Plugin.C", "other.run"), true);
  const first = core.catalogQuery.list("api", { limit: 2 });
  assert.equal(first.status, 200);
  assert.deepEqual(first.value.items.map(x => x.owner),
    ["Plugin.A", "Plugin.B"]);
  assert.equal(first.value.total, 3);
  assert.equal(first.value.nextOffset, 2);
  assert.equal(core.catalogQuery.list("api",
    { offset: 2, limit: 2 }).value.items[0].owner, "Plugin.C");
  assert.ok(Object.isFrozen(first.value.items));
  assert.equal(core.catalogQuery.describe("api", "same.run").status, 409);
  assert.equal(core.catalogQuery.describe("api", "same.run",
    "Plugin.B").value.owner, "Plugin.B");
  assert.equal(core.catalogQuery.describe("api", "absent").status, 404);
  assert.deepEqual(core.catalogQuery.query("api",
    { owner: "Plugin.C" }).value.items.map(x => x.owner), ["Plugin.C"]);
  assert.equal(core.catalogQuery.query("api",
    { term: "same" }).value.total, 2);
  core.unregister("Plugin.A");
  assert.equal(core.catalogQuery.list("api").value.total, 2);
  assert.equal(first.value.total, 3);
});

test("PR02.05 handles Property descriptors, never returns live values", () => {
  const core = new LinkCore();
  const descriptor = {
    apiVersion: 1, name: "CustomColor", type: "string",
    owners: ["Plugin.A"], visibility: "Public",
    readable: true, writable: false
  };
  const result = core.hub.registerProperty("CustomColor", "secret-value", {
    owners: ["Plugin.A"], visibility: "Public", descriptor
  });
  assert.equal(result.status, 201);
  const found = core.catalogQuery.describe("property", "CustomColor");
  assert.equal(found.status, 200);
  assert.equal(found.value.descriptor.name, "CustomColor");
  assert.equal(JSON.stringify(found).includes("secret-value"), false);
  assert.equal(core.catalogQuery.query("property",
    { owner: "Plugin.A" }).value.total, 1);
});

test("PR02.05 rejects malformed selectors and unbounded pages", () => {
  const core = new LinkCore();
  const q = core.catalogQuery;
  for (const opts of [{ limit: 0 }, { limit: 101 },
    { offset: -1 }, { offset: 4097 }, { offset: 1.5 },
    { limit: Infinity }]) {
    assert.equal(q.list("api", opts).status, 400);
  }
  assert.equal(q.list("other").status, 400);
  assert.equal(q.describe("api", "__proto__").status, 400);
  assert.equal(q.query("api", { injected: "x" }).status, 400);
  assert.equal(q.query("api", { term: "x".repeat(129) }).status, 400);
  assert.equal(q.query("api", { owner: "Bad Space" }).status, 400);
  assert.equal(typeof core.catalogQuery.request, "undefined");
});
