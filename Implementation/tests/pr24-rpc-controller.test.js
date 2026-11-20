import test from "node:test";
import assert from "node:assert/strict";
import { PluginBidirectionalRPCController as Controller } from
  "../LinkCore/PluginBidirectionalRPCController.js";

function harness(options = {}) {
  const sent = [];
  const port = {
    postMessage(packet) { sent.push(packet); },
    close() {}
  };
  const session = {
    state: "ready",
    owns(value) { return value === port; }
  };
  const rpc = new Controller(options);
  const answer = (packet, eventId = 1) => ({
    protocol: "cluster.rpc/1",
    direction: "host-to-plugin",
    type: "response",
    requestId: packet.requestId,
    eventId, status: 200, ok: true, data: { accepted: true }
  });
  return { rpc, port, session, sent, answer };
}

test("PR24.21/24 request response matches request and session", async () => {
  const h = harness();
  const pending = h.rpc.request(h.port, h.session,
    "Plugin.Tool", "Run", { count: 2 });
  assert.equal(h.sent.length, 1);
  assert.equal(h.rpc.receive(h.port, h.session,
    h.answer(h.sent[0])).status, 200);
  assert.equal((await pending).data.accepted, true);
  assert.equal(h.rpc.pendingCount, 0);
  assert.equal(h.rpc.receive(h.port, h.session,
    h.answer(h.sent[0])).status, 409);
});

test("PR24.24 parallel out of order response maps correctly", async () => {
  const h = harness();
  const a = h.rpc.request(h.port, h.session, "Tool.A", "Run", {});
  const b = h.rpc.request(h.port, h.session, "Tool.B", "Run", {});
  const second = h.answer(h.sent[1], 9);
  const first = h.answer(h.sent[0], 8);
  h.rpc.receive(h.port, h.session, second);
  h.rpc.receive(h.port, h.session, first);
  assert.equal((await a).eventId, 8);
  assert.equal((await b).eventId, 9);
});

test("PR24.27/28 bounded queue rejects burst and drains FIFO", async () => {
  const h = harness({ maxActive: 1, maxQueue: 1 });
  const a = h.rpc.request(h.port, h.session, "Tool.A", "Run", {});
  const b = h.rpc.request(h.port, h.session, "Tool.B", "Run", {});
  assert.equal(h.sent.length, 1);
  const rejected = await h.rpc.request(h.port, h.session,
    "Tool.C", "Run", {});
  assert.equal(rejected.status, 429);
  h.rpc.receive(h.port, h.session, h.answer(h.sent[0]));
  assert.equal(h.sent.length, 2);
  h.rpc.receive(h.port, h.session, h.answer(h.sent[1]));
  assert.equal((await a).status, 200);
  assert.equal((await b).status, 200);
});

test("PR24.25 deadline and revoked sessions release pending", async () => {
  const h = harness({ timeoutMs: 10 });
  const a = h.rpc.request(h.port, h.session, "Tool.A", "Run", {});
  assert.equal((await a).status, 504);
  assert.equal(h.rpc.pendingCount, 0);
  const b = h.rpc.request(h.port, h.session, "Tool.B", "Run", {});
  assert.equal(h.rpc.revokeSession(h.session), 1);
  assert.equal((await b).status, 499);
});

test("PR24.26 cancellation settles and sends cancel envelope", async () => {
  const h = harness();
  const a = h.rpc.request(h.port, h.session, "Tool.A", "Run", {});
  const id = h.sent[0].requestId;
  assert.equal(h.rpc.cancel(id).status, 200);
  assert.equal((await a).status, 499);
  assert.equal(h.sent[1].type, "cancel");
  assert.equal(h.rpc.receive(h.port, h.session,
    h.answer(h.sent[0])).status, 409);
});

test("PR24.29 rejects foreign port, malformed packets, close", async () => {
  const h = harness();
  const a = h.rpc.request(h.port, h.session, "Tool.A", "Run", {});
  const foreign = {
    state: "ready",
    owns() { return true; }
  };
  assert.equal(h.rpc.receive(h.port, foreign,
    h.answer(h.sent[0])).status, 403);
  assert.equal(h.rpc.receive({}, h.session,
    h.answer(h.sent[0])).status, 403);
  assert.equal(h.rpc.receive(h.port, h.session, {
    ...h.answer(h.sent[0]), callerId: "Host"
  }).status, 400);
  h.rpc.close();
  assert.equal((await a).status, 499);
  assert.equal((await h.rpc.request(h.port, h.session,
    "Tool.B", "Run", {})).status, 403);
});

test("PR24.29 failed transport settles without hanging", async () => {
  const h = harness();
  h.port.postMessage = () => { throw Error("port disconnected"); };
  const result = await h.rpc.request(h.port, h.session,
    "Tool.A", "Run", {});
  assert.equal(result.status, 502);
  assert.equal(h.rpc.pendingCount, 0);
});
