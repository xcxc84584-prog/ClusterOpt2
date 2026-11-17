import test from "node:test";
import assert from "node:assert/strict";
import { APIDescriptorPolicy } from "../property/APIDescriptorPolicy.js";

function example() {
  return {
    apiVersion: 1, id: "editor.highlight", owner: "Editor.Highlighter",
    action: "highlight", version: "1.0.0", visibility: "Public",
    sideEffect: "none",
    inputSchema: {
      type: "object", required: ["text"], properties: {
        text: { type: "string" }, revision: { type: "integer" }
      }
    },
    outputSchema: { type: "array", items: { type: "object" } },
    permissions: ["document.slice.read"]
  };
}
test("descriptor v1 validates, copies and freezes runtime metadata", () => {
  const input = example();
  const result = APIDescriptorPolicy.validate(input);
  assert.equal(result.status, 200);
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result.value));
  assert.ok(Object.isFrozen(result.value.inputSchema.properties));
  input.inputSchema.properties.text.type = "number";
  assert.equal(result.value.inputSchema.properties.text.type, "string");
  assert.throws(() => { result.value.action = "mutate"; }, TypeError);
});
test("unsupported versions, shape, metadata and size are denied", () => {
  for (const changed of [
    { version: "1.0" }, { apiVersion: 2 }, { sideEffect: "admin" },
    { visibility: "all" }, { id: "editor unsafe" },
    { description: "x".repeat(17000) }, { permissions: ["a", "a"] }
  ]) {
    assert.equal(APIDescriptorPolicy.validate({
      ...example(), ...changed
    }).status, 400);
  }
  const invalid = example();
  invalid.inputSchema.required = ["missing"];
  assert.equal(APIDescriptorPolicy.validate(invalid).status, 400);
});
test("prototype, callable and recursive descriptor structures are denied", () => {
  const unsafe = example();
  unsafe.inputSchema.properties.constructor = { type: "string" };
  assert.equal(APIDescriptorPolicy.validate(unsafe).status, 400);
  const func = example();
  func.inputSchema.items = () => 1;
  assert.equal(APIDescriptorPolicy.validate(func).status, 400);
  const circular = example();
  circular.self = circular;
  assert.equal(APIDescriptorPolicy.validate(circular).status, 400);
});
