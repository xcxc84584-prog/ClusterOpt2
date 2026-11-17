import test from "node:test";
import assert from "node:assert/strict";
import { CapabilityIdPolicy as Policy } from
  "../property/CapabilityIdPolicy.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

test("PR03.01 accepts canonical service identifiers", () => {
  for (const id of [
    "editor.highlight", "document.slice.read", "storage.write-back",
    "ext.vendor.capability", "a.b"
  ]) {
    const result = Policy.validate(id);
    assert.equal(result.status, 200, id);
    assert.equal(result.value, id);
    assert.equal(Object.isFrozen(result), true);
  }
  assert.equal(Policy.checkUnique("editor.highlight",
    ["document.slice.read"]).status, 200);
});

test("PR03.01 rejects ambiguous, unsafe, oversized identities", () => {
  for (const id of [
    "", "editor", "Editor.Highlight", "editor.Highlight",
    "editor..highlight", ".editor.highlight", "editor.highlight.",
    "editor.highlight@1", "editor/highlight", "editor.高亮",
    "editor._private", "editor.-highlight", "editor.highlight-",
    "editor.highlight ", "editor..", "__proto__.run",
    "editor.constructor", "editor.prototype", "a.".repeat(9) + "b",
    "a.".repeat(70) + "b", 42, {}, null
  ]) {
    assert.equal(Policy.validate(id).status, 400, String(id));
  }
});

test("PR03.01 collision guard is bounded and does not mutate inputs", () => {
  const names = ["editor.highlight", "document.slice.read"];
  assert.equal(Policy.checkUnique("editor.highlight", names).status, 409);
  assert.equal(Policy.checkUnique("editor.render", names).status, 200);
  assert.equal(Policy.checkUnique("editor.render",
    ["Bad.Name"]).status, 400);
  assert.equal(Policy.checkUnique("editor.render",
    Array(4097).fill("a.b")).status, 400);
  assert.deepEqual(names, ["editor.highlight", "document.slice.read"]);
  assert.equal(Policy.checkUnique("editor.highlight",
    [ "editor.highlight" ]).error, "Duplicate capability ID");
});

test("PR03.01 runs in real detached OCDA VTE via HubUnit", () => {
  const env = new VirtualTestEnvironment();
  const result = env.core.readProperty("VTE", "CapabilityIdPolicy");
  assert.equal(result.status, 200);
  assert.equal(result.value, Policy);
  assert.equal(result.value.validate("editor.highlight").status, 200);
  assert.equal(result.value.checkUnique("editor.highlight",
    ["editor.highlight"]).status, 409);
  assert.ok(env.log().some(event => event.kind === "Log" &&
    event.action === "Property.Read" && event.status === 200));
  assert.equal(env.snapshot().dependencies.length, 0,
    "Metadata validation must not issue an executable REQ");
});
