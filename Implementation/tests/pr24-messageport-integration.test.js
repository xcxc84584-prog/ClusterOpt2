import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { MessageChannel } from "node:worker_threads";
import { ObjectManagementUnit } from
  "../LinkCore/ObjectManagementUnit.js";
import { PluginSessionUnit } from
  "../LinkCore/PluginSessionUnit.js";
import { PluginHostRequestGateway } from
  "../LinkCore/PluginHostRequestGateway.js";
import { PluginHostRequestTransport } from
  "../LinkCore/PluginHostRequestTransport.js";

function setup() {
  const calls = [];
  const manifest = {
    providerId: "example.provider",
    objectId: "ExampleProvider", permissions: []
  };
  const core = {
    uru: {
      objects: new Map([[manifest.objectId, {}]]),
      disabledProviders: new Set(),
      getProvider(id) {
        return id === manifest.providerId ? manifest : null;
      }
    },
    checkPluginPermission: () => true,
    omu: new ObjectManagementUnit(),
    hub: {
      async request(source, target, action, payload) {
        calls.push({ source, target, action, payload });
        return { ok: true, status: 200, value: { echoed: payload.text } };
      }
    }
  };
  let seed = 0;
  const gateway = new PluginHostRequestGateway(core,
    new PluginSessionUnit(() => "id-" + ++seed));
  const adapter = new PluginHostRequestTransport(gateway);
  const channel = new MessageChannel();
  const hello = once(channel.port2, "message");
  assert.equal(adapter.attach(channel.port1,
    manifest.providerId).status, 201);
  return { channel, adapter, calls, core, hello };
}

test("PR24.22/31 real MessagePort -> Session -> Hub -> Response", async () => {
  const h = setup();
  try {
    const [challenge] = await h.hello;
    h.channel.port2.postMessage({
      kind: "cluster-session-ready",
      protocol: challenge.protocol, challenge: challenge.challenge
    });
    const response = once(h.channel.port2, "message");
    h.channel.port2.postMessage({
      protocol: "cluster.rpc/1",
      direction: "plugin-to-host",
      type: "request",
      requestId: "req-001",
      target: "EchoObject",
      action: "Echo",
      payload: { text: "hello" }
    });
    const [packet] = await response;
    assert.equal(packet.ok, true);
    assert.deepEqual(packet.data, { echoed: "hello" });
    assert.ok(packet.eventId > packet.parentEventId);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].source, "ExampleProvider");
  } finally {
    h.adapter.detachAll();
    h.channel.port2.close();
  }
});

test("PR24.18 detaching transport rejects later work", async () => {
  const h = setup();
  try {
    await h.hello;
    assert.equal(h.adapter.detach(h.channel.port1), true);
    assert.equal(h.adapter.detach(h.channel.port1), false);
    assert.equal(h.calls.length, 0);
    assert.equal(h.channel.port1.listenerCount("message"), 0);
  } finally {
    h.adapter.detachAll();
    h.channel.port2.close();
  }
});

test("PR24.7 suspend keeps port; reenable rotates Session ID", async () => {
  const h = setup();
  try {
    const [hello] = await h.hello;
    h.channel.port2.postMessage({
      kind: "cluster-session-ready",
      protocol: hello.protocol, challenge: hello.challenge
    });
    const notice = once(h.channel.port2, "message");
    assert.equal(h.adapter.suspend(h.channel.port1), true);
    const [suspended] = await notice;
    assert.equal(suspended.kind, "cluster-session-suspended");
    assert.equal(h.adapter.gateway.sessions.activeCount, 0);
    const nextHello = once(h.channel.port2, "message");
    const resumed = h.adapter.resume(h.channel.port1, "example.provider");
    assert.equal(resumed.status, 201);
    assert.notEqual(resumed.sessionId, hello.sessionId);
    const [rekey] = await nextHello;
    assert.equal(rekey.sessionId, resumed.sessionId);
    assert.notEqual(rekey.challenge, hello.challenge);
    h.channel.port2.postMessage({
      kind: "cluster-session-ready",
      protocol: rekey.protocol, challenge: rekey.challenge
    });
    const answer = once(h.channel.port2, "message");
    h.channel.port2.postMessage({
      protocol: "cluster.rpc/1", direction: "plugin-to-host",
      type: "request", requestId: "after-rekey",
      target: "EchoObject", action: "Echo",
      payload: { text: "new-session" }
    });
    const [packet] = await answer;
    assert.equal(packet.data.echoed, "new-session");
    assert.equal(h.calls.length, 1);
  } finally {
    h.adapter.detachAll();
    h.channel.port2.close();
  }
});

test("PR24.7 cancellation aborts in-flight Hub request", async () => {
  const h = setup();
  try {
    const [hello] = await h.hello;
    h.channel.port2.postMessage({
      kind: "cluster-session-ready",
      protocol: hello.protocol, challenge: hello.challenge
    });
    let markAbort;
    const aborted = new Promise(resolve => { markAbort = resolve; });
    h.core.hub.request = async (_src, _target, _action,
      _payload, options) => {
      return new Promise(resolve => {
        options.signal.addEventListener("abort", () => {
          markAbort();
          resolve({ ok: false, status: 499 });
        }, { once: true });
      });
    };
    h.channel.port2.postMessage({
      protocol: "cluster.rpc/1", direction: "plugin-to-host",
      type: "request", requestId: "cancel-me",
      target: "EchoObject", action: "Echo", payload: {}
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    h.channel.port2.postMessage({
      protocol: "cluster.rpc/1", direction: "plugin-to-host",
      type: "cancel", requestId: "cancel-me", reason: "ABORTED"
    });
    await aborted;
    assert.equal(h.adapter.gateway.sessions.activeCount, 1);
    assert.ok(h.core.omu.snapshot().logs.some(event =>
      event.action === "RPC.Cancelled" && event.status === 499));
  } finally {
    h.adapter.detachAll();
    h.channel.port2.close();
  }
});
