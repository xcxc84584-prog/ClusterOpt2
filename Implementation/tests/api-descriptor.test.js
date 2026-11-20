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

test("PR23.5 errors/examples are immutable bounded nonexecutable data", () => {
  const valid = {
    ...example(),
    errors: [{
      status: 403, code: "UI_PERMISSION_DENIED",
      message: "No permission"
    }],
    examples: [{
      title: "Read",
      request: { action: "highlight", payload: { text: "hello" } },
      response: { status: 200, ok: true }
    }]
  };
  const result = APIDescriptorPolicy.validate(valid);
  assert.equal(result.status, 200);
  assert.equal(Object.isFrozen(result.value.errors[0]), true);
  assert.equal(Object.isFrozen(result.value.examples[0].request), true);
  valid.examples[0].request.payload.text = "tamper";
  assert.equal(result.value.examples[0].request.payload.text, "hello");
  for (const changed of [
    { errors: [{ status: 200, code: "OK", message: "Bad" }] },
    { errors: [{ status: 403, code: "unsafe key", message: "Bad" }] },
    { errors: [{ status: 403, code: "DENY", message: "x".repeat(257) }] },
    { examples: [{ title: "JS", request: { callback: () => 1 },
      response: {} }] },
    { examples: [{ title: "Unsafe", request: Object.fromEntries(
      [["__proto__", 1]]), response: {} }] }
  ]) {
    const denied = APIDescriptorPolicy.validate({
      ...example(), ...changed
    });
    if (denied.ok) throw Error("Untrusted API documentation accepted");
    assert.equal(denied.status, 400);
  }
});

test("PR25 constrained schemas and structured RPC scopes are validated", () => {
  const valid = example();
  valid.inputSchema.properties.text = {
    type: "string", minLength: 1, maxLength: 4096,
    pattern: "^[a-zA-Z]+$", default: "hello"
  };
  valid.inputSchema.properties.tags = {
    type: "array", minItems: 0, maxItems: 5,
    items: { type: "string", enum: ["a", "b"] }
  };
  valid.rpcScopes = [
    { target: "HubUnit", action: "Property.Read", property: "UI_COLOR" }
  ];
  assert.equal(APIDescriptorPolicy.validate(valid).status, 200);
  for (const patch of [
    { minLength: 10, maxLength: 2 },
    { pattern: "x".repeat(200) },
    { minItems: 1 }
  ]) {
    const invalid = example();
    invalid.inputSchema.properties.text = {
      type: "string", ...patch
    };
    assert.equal(APIDescriptorPolicy.validate(invalid).status, 400);
  }
  const badScope = example();
  badScope.rpcScopes = [{ target: "HubUnit", action: "UI.Delete" }];
  assert.equal(APIDescriptorPolicy.validate(badScope).status, 400);
});

test("PR25 supports legacy deprecation and typed migration guidance", () => {
  const base=example();
  assert.equal(APIDescriptorPolicy.validate({
    ...base, deprecated:true
  }).status,200);
  const accepted=APIDescriptorPolicy.validate({
    ...base, deprecated:true,
    compatibility:"Backward compatible until v2",
    migration:{
      replacementId:"editor.highlightV2",
      since:"1.1.0",
      guide:"Replace highlight with highlightV2"
    }
  });
  assert.equal(accepted.status,200);
  assert.equal(accepted.value.migration.replacementId,
    "editor.highlightV2");
  assert.equal(APIDescriptorPolicy.validate({
    ...base, unavailable:true
  }).status,200);
});
