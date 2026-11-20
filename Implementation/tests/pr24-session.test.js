import test from "node:test";
import assert from "node:assert/strict";
import { PluginSessionUnit } from
  "../LinkCore/PluginSessionUnit.js";

function harness() {
  let serial = 0;
  const unit = new PluginSessionUnit(() => "nonce-" + ++serial);
  const port = {
    packets: [], closed: false,
    postMessage(packet) { this.packets.push(packet); },
    close() { this.closed = true; }
  };
  const create = unit.create(port, "plugin.alpha", "PluginAlpha");
  assert.equal(create.status, 201);
  const hello = port.packets[0];
  const ready = {
    kind: "cluster-session-ready",
    protocol: "cluster.rpc/1",
    challenge: hello.challenge
  };
  const request = (requestId = "req-1") => ({
    protocol: "cluster.rpc/1",
    direction: "plugin-to-host",
    type: "request",
    requestId,
    target: "UICO.Window",
    action: "Window.Open",
    payload: {}
  });
  return { unit, port, create, hello, ready, request };
}

test("PR24.11–15 handshake binds identity to actual MessagePort", () => {
  const h = harness();
  assert.equal(h.create.session.state, "handshake");
  assert.equal(h.unit.inspect(h.port, h.request()).status, 425);
  assert.equal(h.unit.ready({}, h.ready).status, 403);
  assert.equal(h.unit.ready(h.port, {
    ...h.ready, challenge: "wrong"
  }).status, 403);
  assert.equal(h.unit.ready(h.port, h.ready).status, 200);
  assert.equal(h.unit.ready(h.port, h.ready).status, 409);
  const bound = h.unit.inspect(h.port, h.request());
  assert.equal(bound.status, 200);
  assert.equal(bound.session.providerId, "plugin.alpha");
  assert.equal(bound.session.objectId, "PluginAlpha");
});

test("PR24.16–17 forged source and replay fail closed", () => {
  const h = harness();
  h.unit.ready(h.port, h.ready);
  assert.equal(h.unit.inspect(h.port, {
    ...h.request(), callerId: "HubUnit"
  }).status, 400);
  assert.equal(h.unit.inspect(h.port, h.request()).status, 200);
  assert.equal(h.unit.inspect(h.port, h.request()).status, 409);
  assert.equal(h.unit.inspect(h.port, {
    ...h.request("req-2"), direction: "host-to-plugin"
  }).status, 400);
  assert.equal(h.unit.create(h.port, "plugin.beta", "PluginBeta")
    .status, 409);
});

test("PR24.18–19 revoke and replacement invalidate old port", () => {
  const h = harness();
  h.unit.ready(h.port, h.ready);
  assert.equal(h.unit.revokeProvider("plugin.alpha"), 1);
  assert.equal(h.port.closed, true);
  assert.equal(h.unit.activeCount, 0);
  assert.equal(h.unit.inspect(h.port, h.request()).status, 403);
  assert.equal(h.unit.revoke(h.create.session.sessionId).status, 404);
  const replacement = {
    postMessage() {}, close() {}
  };
  const fresh = h.unit.create(replacement, "plugin.alpha", "PluginAlpha");
  assert.equal(fresh.status, 201);
  assert.notEqual(fresh.session.sessionId, h.create.session.sessionId);
  assert.equal(h.unit.inspect(replacement, h.request()).status, 425);
});

test("PR24.20 attack through non-owned port cannot use live session", () => {
  const h = harness();
  h.unit.ready(h.port, h.ready);
  const foreign = { postMessage() {}, close() {} };
  assert.equal(h.unit.inspect(foreign, h.request()).status, 403);
  assert.equal(h.unit.ready(foreign, h.ready).status, 403);
  assert.equal(h.unit.activeCount, 1);
});
