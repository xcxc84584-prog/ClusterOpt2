import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { describeObjectAPIs } from "../LinkCore/ObjectContract.js";

function sample() {
  return {
    id: "Example.Highlight", strictOCDA: true,
    receive: async (_action, payload) => payload,
    ocda: {
      Request: ["highlight"], Response: ["highlight"],
      UserAPI: ["highlight"], AgentAPI: [], Property: [],
      Program: "Test", EHU: "LinkCore.OMU", Log: "LinkCore.OMU",
      APIDescriptors: [{
        apiVersion: 1, id: "editor.highlight",
        owner: "Example.Highlight", action: "highlight",
        version: "1.0.0", visibility: "Public", sideEffect: "none",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" }
      }]
    }
  };
}
test("registered OCDA Object exposes descriptors via internal URU", async () => {
  const core = new LinkCore();
  const object = sample();
  core.register({ id: "ui", receive: async () => null });
  assert.equal(core.register(object), true);
  const description = core.uru.describeAPI(object.id);
  assert.equal(description.status, 200);
  assert.equal(description.value.length, 1);
  assert.equal(description.value[0].action, "highlight");
  assert.ok(Object.isFrozen(description.value));
  const result = await core.request("ui", object.id, "highlight", {
    text: "int x;"
  }, { origin: "user" });
  assert.equal(result.status, 200);
  assert.ok(core.getSnapshot().dependencies.length > 0);
  assert.equal(core.unregister(object.id), true);
  assert.equal(core.uru.describeAPI(object.id).status, 404);
});
test("strict OCDA descriptor lies or duplicates reject with EHU", () => {
  for (const change of ["owner", "action", "visibility", "duplicate"]) {
    const core = new LinkCore();
    const object = sample();
    if (change === "owner") {
      object.ocda.APIDescriptors[0].owner = "Other";
    } else if (change === "action") {
      object.ocda.APIDescriptors[0].action = "delete";
    } else if (change === "visibility") {
      object.ocda.APIDescriptors[0].visibility = "Private";
    } else {
      object.ocda.APIDescriptors.push({
        ...object.ocda.APIDescriptors[0]
      });
    }
    assert.equal(core.register(object), false);
    assert.ok(core.getSnapshot().logs.some(item =>
      item.kind === "EHU" && item.status === 400));
  }
});
test("internal projection refuses an incomplete Object contract", () => {
  assert.equal(describeObjectAPIs({
    id: "partial", receive: async () => null
  }).status, 400);
});
