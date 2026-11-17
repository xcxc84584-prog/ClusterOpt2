import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { PropertyDescriptorPolicy } from
  "../property/PropertyDescriptorPolicy.js";

function example() {
  return {
    apiVersion: 1, name: "ExamplePolicy", type: "object",
    owners: ["LinkCore"], visibility: "Public",
    readable: true, writable: false,
    invariants: ["Mutation must remain HubUnit controlled"]
  };
}

test("metadata is validated, detached and deeply frozen", () => {
  const input = example();
  const result = PropertyDescriptorPolicy.validate(input);
  assert.equal(result.status, 200);
  input.owners[0] = "Other";
  assert.equal(result.value.owners[0], "LinkCore");
  assert.ok(Object.isFrozen(result.value));
  assert.ok(Object.isFrozen(result.value.owners));
  assert.ok(Object.isFrozen(result.value.invariants));
});

test("unsafe schema and mismatched registry identity emit 400 EHU", () => {
  for (const change of [
    { apiVersion: 2 }, { type: "secret" },
    { visibility: "Everyone" }, { owners: ["x", "x"] },
    { name: "__proto__" }, { readable: "true" },
    { invariants: ["a", "a"] }
  ]) {
    assert.equal(PropertyDescriptorPolicy.validate({
      ...example(), ...change
    }).status, 400);
  }
  const core = new LinkCore();
  const bad = core.hub.registerProperty("ExamplePolicy", {}, {
    owners: ["LinkCore"], visibility: "Public",
    descriptor: { ...example(), owners: ["Other"] }
  });
  assert.equal(bad.status, 400);
  assert.equal(core.edpmu.describeProperty("ExamplePolicy").status, 404);
  assert.ok(core.getSnapshot().logs.some(row =>
    row.kind === "EHU" && row.status === 400));
});

test("EDPMU holds one descriptor; Hub remains the read authority", () => {
  const core = new LinkCore();
  const result = core.hub.registerProperty("ExamplePolicy", { ready: true }, {
    owners: ["LinkCore"], visibility: "Public", descriptor: example()
  });
  assert.equal(result.status, 201);
  assert.equal(core.edpmu.describeProperty("ExamplePolicy").value.name,
    "ExamplePolicy");
  assert.equal(core.edpmu.describeProperty("APIDescriptorPolicy").value,
    null);
  core.register({ id: "ui", receive: async () => null });
  assert.equal(core.readProperty("ui", "ExamplePolicy").status, 200);
  assert.equal(core.readProperty("ghost", "ExamplePolicy").status, 404);
  assert.equal(core.hub.registerProperty("ExamplePolicy", {}, {
    owners: ["LinkCore"]
  }).status, 409);
  assert.equal(core.edpmu.unregister("ExamplePolicy"), true);
  assert.equal(core.edpmu.describeProperty("ExamplePolicy").status, 404);
});
