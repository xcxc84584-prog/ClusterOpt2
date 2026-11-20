import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";

function descriptor(owner) {
  return {
    apiVersion: 1, id: "editor.highlight", owner,
    action: "highlight", version: "1.0.0",
    visibility: "Public", sideEffect: "none",
    inputSchema: { type: "object" },
    outputSchema: { type: "object" }
  };
}

function object(owner) {
  return {
    id: owner, strictOCDA: true,
    receive: async (_action, payload) => payload,
    ocda: {
      Request: ["highlight"], Response: ["highlight"],
      UserAPI: ["highlight"], AgentAPI: [], Property: [],
      Program: "Test", EHU: "LinkCore.OMU", Log: "LinkCore.OMU",
      APIDescriptors: [descriptor(owner)]
    }
  };
}

test("PR02.04 collects live URU and EDPMU without duplicating state", () => {
  const core = new LinkCore();
  const before = core.catalog.collect();
  assert.equal(before.status, 200);
  assert.equal(before.value.apis.length, 4);
  assert.equal(before.value.properties.length, 0);

  assert.equal(core.register(object("Example.Highlight")), true);
  const property = {
    apiVersion: 1, name: "ExamplePalette", type: "string",
    owners: ["Example.Highlight"], visibility: "Public",
    readable: true, writable: false
  };
  assert.equal(core.hub.registerProperty("ExamplePalette", "light", {
    owners: ["Example.Highlight"], visibility: "Public",
    descriptor: property
  }).status, 201);
  const collected = core.catalog.collect();
  assert.equal(collected.value.apis.length, 5);
  assert.equal(collected.value.properties.length, 1);
  assert.equal(collected.value.apis[0].descriptor.id, "editor.highlight");
  assert.equal(collected.value.properties[0].descriptor.name,
    "ExamplePalette");
  assert.ok(Object.isFrozen(collected.value.apis[0]));
  assert.ok(Object.isFrozen(collected.value.properties[0]));

  assert.equal(core.unregister("Example.Highlight"), true);
  assert.equal(core.edpmu.unregister("ExamplePalette"), true);
  assert.deepEqual(core.catalog.collect().value.apis, before.value.apis);
  assert.deepEqual(core.catalog.collect().value.properties, []);
  assert.equal(collected.value.apis.length, 5,
    "Old snapshot stays detached from later registration changes");
});

test("PR02.04 catalog cannot expose live values or invoke handlers", () => {
  const core = new LinkCore();
  let invoked = 0;
  const target = object("Example.Highlight");
  target.receive = async () => { invoked++; return "secret"; };
  assert.equal(core.register(target), true);
  const snapshot = core.catalog.collect();
  assert.equal(snapshot.status, 200);
  assert.equal(invoked, 0);
  assert.equal(JSON.stringify(snapshot.value).includes("secret"), false);
  assert.equal("receive" in snapshot.value.apis[0], false);
  assert.equal(typeof core.catalog.request, "undefined");
});

test("legacy Objects remain registered without publishing synthetic APIs", () => {
  const core = new LinkCore();
  assert.equal(core.register({
    id: "Legacy.Editor", receive: async (_name, payload) => payload
  }), true);
  const snapshot = core.catalog.collect();
  assert.equal(snapshot.status, 200);
  assert.equal(snapshot.value.apis.length, 4);
  assert.equal(core.discover("Legacy.Editor", "list", "api").status, 200);
  assert.equal(core.uru.objects.has("Legacy.Editor"), true);
});
