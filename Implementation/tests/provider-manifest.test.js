import test from "node:test";
import assert from "node:assert/strict";
import { ProviderManifestPolicy as Policy } from
  "../property/ProviderManifestPolicy.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

function sample() {
  return {
    manifestVersion: 1,
    providerId: "vendor.highlighter",
    objectId: "Vendor.Highlighter",
    provides: [{
      service: "editor.highlight",
      action: "highlight", version: "1.0.0",
      inputSchema: { type: "object" },
      outputSchema: { type: "array", items: { type: "string" } }
    }],
    requires: ["document.slice.read"],
    permissions: ["document.slice.read"],
    execution: { isolation: "worker", concurrency: "per-slice" }
  };
}

test("PR03.02 manifest validates and freezes detached data", () => {
  const data = sample();
  const result = Policy.validate(data);
  assert.equal(result.status, 200);
  assert.ok(Object.isFrozen(result.value));
  assert.ok(Object.isFrozen(result.value.provides[0].inputSchema));
  data.provides[0].inputSchema.type = "boolean";
  assert.equal(result.value.provides[0].inputSchema.type, "object");
  assert.throws(() => { result.value.providerId = "different"; },
    TypeError);
  assert.equal(Policy.validate(result.value).status, 200,
    "Validated immutable manifest remains a valid input");
});

test("PR03.02 rejects malformed versions, IDs and contracts", () => {
  const changes = [
    { manifestVersion: 2 }, { providerId: "Bad.Provider" },
    { objectId: "Bad Object" },
    { provides: [] }, { provides: [{
      ...sample().provides[0], service: "Editor.Highlight"
    }] },
    { provides: [{
      ...sample().provides[0], version: "1.0"
    }] },
    { provides: [{
      ...sample().provides[0], inputSchema: { type: "invalid" }
    }] },
    { requires: ["editor.highlight"] },
    { permissions: ["unsafe permission"] },
    { execution: { isolation: "main", concurrency: "serial" } },
    { execution: { isolation: "worker", concurrency: "unbounded" } },
    { unknown: "hidden" }
  ];
  for (const change of changes) {
    assert.equal(Policy.validate({ ...sample(), ...change }).status, 400,
      JSON.stringify(change));
  }
});

test("PR03.02 duplicate services, oversized data, executable input denied",
  () => {
    const same = sample();
    same.provides.push({ ...same.provides[0], action: "other" });
    assert.equal(Policy.validate(same).status, 400);
    const repeated = sample();
    repeated.requires.push("document.slice.read");
    assert.equal(Policy.validate(repeated).status, 400);
    const oversize = sample();
    oversize.permissions = Array.from({ length: 65 }, (_, i) =>
      "permission.name-" + i);
    assert.equal(Policy.validate(oversize).status, 400);
    const functionValue = sample();
    functionValue.execution.run = () => "execute";
    assert.equal(Policy.validate(functionValue).status, 400);
    const cyclic = sample();
    cyclic.requires.push(cyclic);
    assert.equal(Policy.validate(cyclic).status, 400);
    const pollution = sample();
    pollution.provides[0].inputSchema.properties = {
      constructor: { type: "string" }
    };
    assert.equal(Policy.validate(pollution).status, 400);
    const getter = sample();
    Object.defineProperty(getter, "permissions", {
      enumerable: true, get() { throw Error("untrusted getter"); }
    });
    assert.equal(Policy.validate(getter).status, 400);
  });

test("PR03.02 real detached VTE reads policy without executing services",
  () => {
    const env = new VirtualTestEnvironment();
    const found = env.core.readProperty("VTE", "ProviderManifestPolicy");
    assert.equal(found.status, 200);
    assert.equal(found.value.validate(sample()).status, 200);
    assert.equal(found.value.validate({ ...sample(),
      permissions: ["invalid permission"] }).status, 400);
    assert.equal(env.snapshot().dependencies.length, 0);
    assert.ok(env.log().some(event =>
      event.action === "Property.Read" && event.status === 200));
  });
