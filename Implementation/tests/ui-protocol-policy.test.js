import test from "node:test";
import assert from "node:assert/strict";
import { UIProtocolPolicy as protocol } from
  "../property/UIProtocolPolicy.js";

const request = (action, payload = {}) => ({
  protocol: "cluster.ui/1",
  requestId: "req-101",
  targetId: "UICO",
  action,
  payload
});

test("PR23.2 validates immutable discover contract", () => {
  const result = protocol.validateRequest(request("UI.List"));
  assert.equal(result.ok, true);
  assert.equal(result.capability, "ui.read");
  assert.equal(Object.isFrozen(result.value), true);
});

test("PR23.2 accepts declared button creation without granting access", () => {
  const input = request("UI.Create", {
    kind: "button",
    parentId: "slot.plugin-toolbar",
    props: { width: 120, label: "Open" },
    onActivateAction: "plugin.example.open"
  });
  const result = protocol.validateRequest(input);
  assert.equal(result.ok, true);
  assert.equal(result.capability, "ui.create.own");
  assert.equal(Object.isFrozen(result.value.payload.props), true);
});

test("PR23.2 rejects identity spoofing and unknown actions", () => {
  assert.equal(protocol.validateRequest({
    ...request("UI.List"), callerId: "root"
  }).ok, false);
  assert.equal(protocol.validateRequest(request("UI.Eval")).ok, false);
});

test("PR23.2 blocks prototype pollution and executable payloads", () => {
  const proto = JSON.parse('{"__proto__":{"admin":true}}');
  assert.equal(protocol.validateRequest(request("UI.List", proto)).ok, false);
  assert.equal(protocol.validateRequest(request("UI.List", {
    handler: () => true
  })).ok, false);
});

test("PR23.2 rejects malformed, unbounded batches", () => {
  const item = { action: "UI.Remove", payload: { uiId: "abc" } };
  assert.equal(protocol.validateRequest(request("UI.Batch", {
    operations: Array.from({ length: 51 }, () => item)
  })).ok, false);
  assert.equal(protocol.validateRequest(request("UI.Batch", {
    operations: [{ action: "UI.Eval", payload: {} }]
  })).ok, false);
});

test("PR23.2 checks revision and deadline bounds", () => {
  assert.equal(protocol.validateRequest({
    ...request("UI.List"), expectedRevision: -1
  }).ok, false);
  assert.equal(protocol.validateRequest({
    ...request("UI.List"), deadlineMs: 999999
  }).ok, false);
});

test("PR23.2 validates correlation and status in responses", () => {
  const success = {
    requestId: "req-101", eventId: 901, status: 201,
    ok: true, revision: 1, data: { uiId: "plugin.open" }
  };
  assert.equal(protocol.validateResponse(success).ok, true);
  assert.equal(protocol.validateResponse({
    ...success, status: 403
  }).ok, false);
  assert.equal(protocol.validateResponse({
    requestId: "req-102", eventId: 902, status: 403, ok: false,
    error: { code: "UI_PERMISSION_DENIED", message: "Denied" }
  }).ok, true);
});

test("PR23.2 rejects malicious responses", () => {
  assert.equal(protocol.validateResponse({
    requestId: "x", eventId: 2, status: 200, ok: true,
    data: { bad: Number.NaN }
  }).ok, false);
  assert.equal(protocol.validateResponse({
    requestId: "x", eventId: 2, status: 500, ok: false
  }).ok, false);
});
