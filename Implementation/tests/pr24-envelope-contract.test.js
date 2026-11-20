import test from "node:test";
import assert from "node:assert/strict";
import { PluginBidirectionalEnvelopePolicy as Contract } from
  "../property/PluginBidirectionalEnvelopePolicy.js";

const request = (overrides = {}) => ({
  protocol: "cluster.rpc/1",
  direction: "plugin-to-host",
  type: "request",
  requestId: "req-1",
  target: "UICO.Window",
  action: "Window.Open",
  payload: { title: "Settings" },
  ...overrides
});

test("PR24.03 both request directions share one envelope", () => {
  assert.equal(Contract.inspect(request()).status, 200);
  assert.equal(Contract.inspect(request({
    direction: "host-to-plugin"
  })).status, 200);
  assert.equal(Contract.inspect(request({
    deadlineMs: 30000, parentEventId: 9
  })).status, 200);
});

test("PR24.05 successful and unsuccessful responses are typed", () => {
  const response = {
    protocol: "cluster.rpc/1",
    direction: "host-to-plugin",
    type: "response",
    requestId: "req-1",
    eventId: 11,
    status: 200,
    ok: true,
    data: { accepted: true }
  };
  assert.equal(Contract.inspect(response).status, 200);
  assert.equal(Contract.inspect({
    ...response, status: 403, ok: false, data: undefined,
    error: { code: "ACCESS_DENIED", message: "Denied" }
  }).ok, false);
  const { data: _unused, ...withoutData } = response;
  assert.equal(Contract.inspect({
    ...withoutData, status: 403, ok: false,
    error: { code: "ACCESS_DENIED", message: "Denied" }
  }).status, 200);
  assert.equal(Contract.inspect({
    ...response, status: 500, ok: true
  }).errorCode, "INVALID_RESPONSE");
});

test("PR24.09 rejects unknown keys, spoofing and unsafe structures", () => {
  const attacks = [
    request({ callerId: "Host" }),
    request({ sessionId: "fake" }),
    request({ target: "__proto__.admin" }),
    request({ action: "run();evil()" }),
    request({ deadlineMs: 30001 }),
    request({ parentEventId: -1 }),
    request({ requestId: "" }),
    request({ payload: () => 5 }),
    request({ payload: { __proto__: null, nested: new Date() } }),
    request({ payload: "x".repeat(70000) }),
    request({ protocol: "cluster.rpc/0" })
  ];
  for (const attack of attacks) {
    assert.equal(Contract.inspect(attack).ok, false);
  }
});

test("PR24.06 cancellation and binding reject forged source", () => {
  const cancel = {
    protocol: "cluster.rpc/1",
    direction: "plugin-to-host",
    type: "cancel",
    requestId: "req-1",
    reason: "user"
  };
  assert.equal(Contract.inspect(cancel).status, 200);
  assert.equal(Contract.bind(request(), {
    sessionId: "s1", providerId: "p1", objectId: "o1"
  }).status, 403);
  const trusted = Object.freeze({
    sessionId: "s1", providerId: "p1", objectId: "o1"
  });
  const bound = Contract.bind(request(), trusted);
  assert.equal(bound.status, 200);
  assert.equal(bound.session, trusted);
  assert.equal(Contract.inspect({
    ...cancel, source: "admin"
  }).status, 400);
});
