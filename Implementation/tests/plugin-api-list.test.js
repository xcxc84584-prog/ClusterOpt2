import test from "node:test";
import assert from "node:assert/strict";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

function provider() {
  return {
    manifestVersion: 1,
    providerId: "user.contract",
    objectId: "User.Contract",
    provides: [{
      service: "editor.syntax.tokens",
      action: "tokenize",
      version: "1.0.0",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"]
      },
      outputSchema: {
        type: "object",
        properties: {
          tokens: { type: "array", items: { type: "string" } }
        }
      }
    }],
    requires: [], permissions: [],
    execution: { isolation: "worker", concurrency: "serial" }
  };
}

test("PR13 HubUnit discovers symmetric Provider input/output", () => {
  const env = new VirtualTestEnvironment();
  assert.equal(env.core.register({
    id: "User.Contract", receive: async () => null
  }), true);
  assert.equal(env.core.registerProvider(
    "User.Contract", provider()).ok, true);
  const result = env.core.listProviderContracts("VTE");
  assert.equal(result.status, 200);
  const item = result.value.items.find(entry =>
    entry.providerId === "user.contract");
  assert.equal(item.inputSchema.properties.text.type, "string");
  assert.equal(item.outputSchema.properties.tokens.type, "array");
  assert.equal(item.action, "tokenize");
  assert.equal(env.core.uru.listProviders().length, 1);
});

test("PR13 HubUnit discovery is read-only, deny unknown source", () => {
  const env = new VirtualTestEnvironment();
  assert.equal(env.core.listProviderContracts("unknown").status, 404);
  assert.equal(env.core.listProviderContracts("VTE",{
    offset: -1
  }).status, 400);
  assert.equal(env.core.listProviderContracts("VTE",{
    limit: 1001
  }).status, 400);
  assert.equal(env.core.listProviderContracts("VTE").value.total, 0);
  assert.ok(env.log().some(x=>x.kind==="EHU" &&
    x.action==="Provider.Contract.List"));
});

test("PR13 HubUnit drops disabled Provider from API contracts", () => {
  const env = new VirtualTestEnvironment();
  env.core.register({
    id: "User.Contract", receive: async () => null
  });
  env.core.registerProvider("User.Contract",provider());
  const disabled = env.core.setProviderEnabled(
    "User.Contract","user.contract",false);
  assert.equal(disabled.ok,true);
  assert.equal(env.core.listProviderContracts("VTE").value.total,0);
});
