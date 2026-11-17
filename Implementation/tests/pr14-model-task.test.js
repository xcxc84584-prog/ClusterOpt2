import test from "node:test";
import assert from "node:assert/strict";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";
import { PluginModelTaskObject } from
  "../object/PluginModelTaskObject.js";
import { PluginModelTaskPolicy as Policy } from
  "../property/PluginModelTaskPolicy.js";
import { readFileSync } from "node:fs";

const provider = JSON.parse(readFileSync(new URL(
  "../plugins/ai-agent-mcp/plugin.json", import.meta.url),
"utf8")).provider;

function fixture() {
  const vte = new VirtualTestEnvironment();
  vte.core.register({ id: "ui", receive: async () => null });
  const sent = [];
  const localId = "VTE.Agent";
  const agent = {
    id: localId, authorization: { default: "Public" },
    strictOCDA: true,
    ocda: {
      EHU: [], Log: [],
      Request: ["providerSet", "providerGet", "taskStart", "taskCancel"],
      Response: [], UserAPI: [], AgentAPI: [], Property: [],
      Program: "MockAgent"
    },
    receive: async (action, payload, context) => {
      assert.equal(context.source, controller.id);
      sent.push({ action, payload });
      return { sent: true };
    }
  };
  assert.equal(vte.core.register(agent), true);
  assert.equal(vte.core.register({
    id: provider.objectId,
    receive: async () => null,
    ocda: {
      Request: ["getStatus", "describe"], Response: [],
      UserAPI: [], AgentAPI: [], Property: [],
      Program: "MockPlugin", EHU: [], Log: []
    }
  }), true);
  assert.equal(vte.core.registerProvider(
    provider.objectId, provider).status, 201);
  const updates = [];
  const controller = new PluginModelTaskObject(vte.core,
    provider.providerId, localId, update => updates.push(update));
  assert.equal(vte.core.register(controller), true);
  function grant(capability) {
    assert.equal(vte.core.grantPluginPermission(
      provider.objectId, provider.providerId,
      capability, true).status, 200);
  }
  return {
    vte, controller, sent, updates, grant,
    request: (action, payload = {}) => vte.core.request(
      "ui", controller.id, action, payload, { origin: "user" }),
    ingest: (message) => vte.core.request(localId,
      controller.id, "ingest", message),
    reset: () => vte.core.request(localId,
      controller.id, "reset", {})
  };
}

test("PR14.5 policy rejects oversized/malformed task payloads", () => {
  assert.equal(Policy.promptValid("hello"), true);
  assert.equal(Policy.promptValid(""), false);
  assert.equal(Policy.promptValid("x".repeat(8001)), false);
  assert.equal(Policy.modelValid("gpt-4.1-mini"), true);
  assert.equal(Policy.modelValid("bad/key"), false);
  assert.equal(Policy.taskResult({ type: "task_result",
    requestId: crypto.randomUUID(), text: "safe" }), true);
  assert.equal(Policy.taskResult({ type: "task_result",
    requestId: crypto.randomUUID(),
    text: "x".repeat(65537) }), false);
  assert.equal(Policy.taskMessage({ type: "tool_call" }), false);
});

test("PR14.5 distinct grants prevent network-only model calls",
  async () => {
    const h = fixture();
    h.grant("network.request");
    h.grant("local-agent.pair");
    assert.equal((await h.request("configure")).status, 403);
    assert.equal((await h.request("submit",
      { prompt: "hello" })).status, 403);
    assert.equal(h.sent.length, 0);
    assert.ok(h.vte.log().some(item =>
      item.kind === "EHU" && item.status === 403));
  });

test("PR14.5 provider configuration runs through Hub without API key",
  async () => {
    const h = fixture();
    h.grant("model.configure");
    const result = await h.request("configure");
    assert.equal(result.status, 200);
    assert.deepEqual(h.sent[0], {
      action: "providerSet", payload: {}
    });
    const reply = await h.ingest({
      type: "provider_info", configured: true, model: "gpt-4.1-mini"
    });
    assert.equal(reply.status, 200);
    assert.equal((await h.request("state")).value.configured, true);
    assert.equal(JSON.stringify(h.vte.log()).includes("sk-"), false);
  });

test("PR14.5 task send, busy, result, cancel and reset", async () => {
  const h = fixture();
  h.grant("model.task");
  const first = await h.request("submit", { prompt: "Hello!" });
  assert.equal(first.status, 200);
  const id = first.value.requestId;
  assert.equal(h.sent[0].action, "taskStart");
  assert.equal(h.sent[0].payload.requestId, id);
  assert.equal((await h.request("submit",
    { prompt: "second" })).status, 409);
  assert.equal((await h.ingest({
    type: "task_status", requestId: id,
    status: "running", message: "Processing"
  })).status, 200);
  assert.equal((await h.ingest({
    type: "task_result", requestId: id, text: "Response"
  })).status, 200);
  assert.equal(h.updates.some(update =>
    update.kind === "result" && update.text === "Response"), true);
  const cancelled = await h.request("cancel");
  assert.equal(cancelled.status, 200);
  assert.equal(h.sent[1].action, "taskCancel");
  assert.equal((await h.ingest({
    type: "task_status", requestId: id,
    status: "interrupted", message: "Cancelled"
  })).status, 200);
  assert.equal((await h.request("state")).value.activeId, null);
  assert.equal((await h.reset()).status, 200);
});

test("PR14.5 forged task reply and unauthorized actor fail closed",
  async () => {
    const h = fixture();
    h.grant("model.task");
    assert.equal((await h.ingest({
      type: "task_result", requestId: crypto.randomUUID(),
      text: "unmatched"
    })).status, 409);
    assert.equal((await h.vte.core.request("VTE",
      h.controller.id, "ingest", {
        type: "provider_info", configured: true,
        model: "gpt-4.1-mini"
      })).status, 403);
    assert.equal((await h.request("submit",
      { prompt: " " })).status, 400);
  });
