import test from "node:test";
import assert from "node:assert/strict";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";
import { PluginHostInstallUnit } from
  "../LinkCore/PluginHostInstallUnit.js";
import { PluginLocalAgentObject } from
  "../object/PluginLocalAgentObject.js";
import { PluginLocalAgentPolicy } from
  "../property/PluginLocalAgentPolicy.js";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(
  new URL("../plugins/ai-agent-mcp/plugin.json", import.meta.url),
  "utf8"));

const token = "a".repeat(64);

function harness(promptValue = token) {
  const env = new VirtualTestEnvironment();
  env.core.register({ id: "ui", receive: async () => null });
  const local = {
    prompt: () => promptValue,
    crypto: { randomUUID: () =>
      "11111111-1111-4111-8111-111111111111" }
  };
  const doc = { defaultView: local };
  let socket;
  class FakeSocket {
    constructor() {
      this.sent = [];
      this.closed = false;
      socket = this;
      queueMicrotask(() => this.onopen?.());
    }
    send(raw) {
      const data = JSON.parse(raw);
      this.sent.push(data);
      if (data.type === "auth" && data.token === token) {
        queueMicrotask(() => this.onmessage?.({
          data: JSON.stringify({ type: "ready", maxSessions: 8 })
        }));
      }
      if (data.type === "ping") {
        queueMicrotask(() => this.onmessage?.({
          data: JSON.stringify({
            type: "pong", requestId: data.requestId
          })
        }));
      }
    }
    close() { this.closed = true; }
  }
  const agent = new PluginLocalAgentObject(
    env.core, manifest.provider.providerId, doc,
    () => new FakeSocket());
  assert.equal(env.core.register(agent), true);
  return {
    env, agent, get socket() { return socket; },
    grant() {
      const target = manifest.provider.objectId;
      env.core.register({ id: target, receive: async () => null,
        ocda: {
          Request: ["getStatus", "describe"], Response: [],
          UserAPI: [], AgentAPI: [], Property: [],
          Program: "TestProvider", EHU: [], Log: []
        } });
      assert.equal(env.core.registerProvider(
        target, manifest.provider).status, 201);
      for (const name of manifest.provider.permissions) {
        assert.equal(env.core.grantPluginPermission(
          target, manifest.provider.providerId,
          name, true).status, 200);
      }
    },
    request(action) {
      return env.core.request("ui", agent.id,
        action, {}, { origin: "user" });
    }
  };
}

test("PR14.4 token and message contract rejects unsafe input", () => {
  assert.equal(PluginLocalAgentPolicy.validToken(token), true);
  assert.equal(PluginLocalAgentPolicy.validToken("b".repeat(63)), false);
  assert.equal(PluginLocalAgentPolicy.inspectMessage(
    JSON.stringify({ type: "tool_call" })).status, 403);
  assert.equal(PluginLocalAgentPolicy.inspectMessage(
    JSON.stringify({ type: "ready" })).status, 200);
  assert.equal(PluginLocalAgentPolicy.inspectMessage(
    "{invalid").status, 400);
});

test("PR14.4 Hub denies pairing without explicit network grant",
  async () => {
    const h = harness();
    const result = await h.request("pair");
    assert.equal(result.status, 403);
    assert.equal(h.socket, undefined);
    assert.ok(h.env.log().some(item =>
      item.kind === "EHU" && item.status === 403));
  });

test("PR14.4 authenticated pairing, ping, disconnect through Hub",
  async () => {
    const h = harness();
    h.grant();
    const paired = await h.request("pair");
    assert.equal(paired.status, 200);
    assert.deepEqual(paired.value, { state: "connected" });
    assert.equal(h.socket.sent[0].type, "auth");
    assert.equal(h.socket.sent[0].token, token);
    const ping = await h.request("ping");
    assert.equal(ping.status, 200);
    assert.equal(h.socket.sent[1].type, "ping");
    assert.equal(h.socket.sent.some(item =>
      item.type === "bridge_register" || item.type === "task"), false);
    const disconnected = await h.request("disconnect");
    assert.equal(disconnected.status, 200);
    assert.equal(h.socket.closed, true);
    assert.equal(h.agent.state, "disconnected");
    assert.equal(JSON.stringify(h.env.log()).includes(token), false);
    assert.ok(h.env.snapshot().dependencies.some(item =>
      item.link.startsWith("ui->") || item.link.endsWith("->ui")));
  });

test("PR14.4 invalid pairing token is never sent", async () => {
  const h = harness("unsafe");
  h.grant();
  const result = await h.request("pair");
  assert.equal(result.status, 400);
  assert.equal(h.socket, undefined);
  assert.equal(h.agent.state, "disconnected");
});

test("PR14.4 unsolicited tool_call closes the socket", async () => {
  const h = harness();
  h.grant();
  assert.equal((await h.request("pair")).status, 200);
  h.socket.onmessage({
    data: JSON.stringify({ type: "tool_call",
      name: "cluster.powershell_request", requestId: "1" })
  });
  assert.equal(h.socket.closed, true);
  assert.equal(h.agent.state, "disconnected");
  assert.ok(h.env.log().some(item => item.kind === "EHU" &&
    item.action === "Plugin.LocalAgent.UnexpectedMessage"));
});

test("PR14.4 revoked permission blocks new ping", async () => {
  const h = harness();
  h.grant();
  assert.equal((await h.request("pair")).status, 200);
  const revoke = h.env.core.revokePluginPermission(
    manifest.provider.objectId, manifest.provider.providerId,
    "network.request");
  assert.equal(revoke.status, 200);
  assert.equal((await h.request("ping")).status, 403);
  h.agent.close();
});
