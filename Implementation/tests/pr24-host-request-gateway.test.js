import test from "node:test";
import assert from "node:assert/strict";
import { ObjectManagementUnit } from
  "../LinkCore/ObjectManagementUnit.js";
import { PluginHostRequestGateway } from
  "../LinkCore/PluginHostRequestGateway.js";
import { PluginSessionUnit } from
  "../LinkCore/PluginSessionUnit.js";

function harness() {
  let sequence = 0;
  const provider = {
    providerId: "plugin.alpha",
    objectId: "PluginAlpha",
    permissions: ["file.read"]
  };
  let enabled = true;
  let granted = true;
  const calls = [];
  const core = {
    uru: {
      objects: new Map([["PluginAlpha", {}]]),
      disabledProviders: new Set(),
      getProvider(id) {
        return enabled && id === provider.providerId ?
          provider : null;
      }
    },
    checkPluginPermission() { return granted; },
    hub: {
      async request(source, target, action, payload, options) {
        calls.push({ source, target, action, payload, options });
        return { ok: true, status: 200,
          value: { answer: payload.number + 1 } };
      }
    },
    omu: new ObjectManagementUnit()
  };
  const port = {
    sent: [], closed: false,
    postMessage(packet) { this.sent.push(packet); },
    close() { this.closed = true; }
  };
  const sessions = new PluginSessionUnit(() => "random-" + ++sequence);
  const gateway = new PluginHostRequestGateway(core, sessions);
  const session = gateway.create(port, provider.providerId);
  assert.equal(session.status, 201);
  const hello = port.sent[0];
  assert.equal(gateway.ready(port, {
    kind: "cluster-session-ready",
    protocol: hello.protocol, challenge: hello.challenge
  }).status, 200);
  const request = (id = "req-1") => ({
    protocol: "cluster.rpc/1",
    direction: "plugin-to-host", type: "request",
    requestId: id, target: "FileReader",
    action: "Read", payload: { number: 3 }
  });
  return {
    gateway, session, port, core, calls, request,
    disable() { enabled = false; },
    revokeGrant() { granted = false; }
  };
}

test("PR24.31 reverse RPC uses session caller, never payload caller", async () => {
  const h = harness();
  const result = await h.gateway.receive(h.port, h.request());
  assert.equal(result.status, 200);
  assert.equal(result.value.status, 200);
  assert.equal(result.value.data.answer, 4);
  assert.ok(result.value.eventId > result.value.parentEventId);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].source, "PluginAlpha");
  assert.equal(h.calls[0].options.origin, "user");
  assert.equal(h.core.omu.snapshot().logs.some(x =>
    x.action.startsWith("RPC.Response.")), true);
});

test("PR24.43 fresh capability check denies revoked grant", async () => {
  const h = harness();
  h.revokeGrant();
  assert.equal((await h.gateway.receive(h.port,
    h.request())).status, 403);
  assert.equal(h.calls.length, 0);
  assert.ok(h.core.omu.snapshot().logs.some(x =>
    x.kind === "EHU" && x.action === "RPC.PermissionRejected"));
});

test("PR24.18 disabled provider and replay fail closed", async () => {
  const h = harness();
  assert.equal((await h.gateway.receive(h.port,
    h.request())).status, 200);
  assert.equal((await h.gateway.receive(h.port,
    h.request())).status, 409);
  h.disable();
  assert.equal((await h.gateway.receive(h.port,
    h.request("req-2"))).status, 403);
  assert.equal(h.calls.length, 1);
  h.gateway.revokeProvider("plugin.alpha");
  assert.equal(h.port.closed, true);
  assert.equal((await h.gateway.receive(h.port,
    h.request("req-3"))).status, 403);
});

test("PR24.16 forged caller and foreign port are rejected", async () => {
  const h = harness();
  assert.equal((await h.gateway.receive(h.port, {
    ...h.request(), callerId: "System"
  })).status, 400);
  const foreign = { postMessage() {}, close() {} };
  assert.equal((await h.gateway.receive(foreign,
    h.request())).status, 403);
  assert.equal(h.calls.length, 0);
});

test("PR24.35 Hub failures become correlated EHU response", async () => {
  const h = harness();
  h.core.hub.request = async () => ({
    ok: false, status: 403, error: "ACL"
  });
  const result = await h.gateway.receive(h.port, h.request());
  assert.equal(result.value.status, 403);
  assert.equal(result.value.ok, false);
  assert.equal(result.value.error.code, "REQUEST_DENIED");
  assert.ok(h.core.omu.snapshot().logs.some(x =>
    x.kind === "EHU" && x.details.requestId === "req-1"));
});
