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

async function within(promise, name, ms = 1500) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() =>
          reject(new Error("MessagePort timed out: " + name)), ms);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

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
    new PluginSessionUnit(() => "id-" + ++seed),
    [{ target: "EchoObject", action: "Echo" }]);
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
    const [suspended] = await within(notice, "suspend notice");
    assert.equal(suspended.kind, "cluster-session-suspended");
    assert.equal(h.adapter.gateway.sessions.activeCount, 0);
    const nextHello = once(h.channel.port2, "message");
    const resumed = h.adapter.resume(h.channel.port1, "example.provider");
    assert.equal(resumed.status, 201);
    assert.notEqual(resumed.sessionId, hello.sessionId);
    const [rekey] = await within(nextHello, "new challenge");
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
    const [packet] = await within(answer, "post-rekey response");
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
    let markStart;
    const started = new Promise(resolve => { markStart = resolve; });
    const aborted = new Promise(resolve => { markAbort = resolve; });
    h.core.hub.request = async (_src, _target, _action,
      _payload, options) => {
      return new Promise(resolve => {
        markStart();
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
    await within(started, "host request started");
    h.channel.port2.postMessage({
      protocol: "cluster.rpc/1", direction: "plugin-to-host",
      type: "cancel", requestId: "cancel-me", reason: "ABORTED"
    });
    await within(aborted, "cancel abort propagated");
    assert.equal(h.adapter.gateway.sessions.activeCount, 1);
    assert.ok(h.core.omu.snapshot().logs.some(event =>
      event.action === "RPC.Cancelled" && event.status === 499));
  } finally {
    h.adapter.detachAll();
    h.channel.port2.close();
  }
});

test("PR24.7 overloaded transport returns typed 429 immediately", async () => {
  const h = setup();
  try {
    const [hello] = await h.hello;
    h.channel.port2.postMessage({
      kind: "cluster-session-ready",
      protocol: hello.protocol, challenge: hello.challenge
    });
    h.adapter.maxInflight = 1;
    let finish;
    let markStarted;
    const started = new Promise(resolve => { markStarted = resolve; });
    h.core.hub.request = async () => {
      markStarted();
      return new Promise(resolve => { finish = resolve; });
    };
    h.channel.port2.postMessage({
      protocol: "cluster.rpc/1", direction: "plugin-to-host",
      type: "request", requestId: "slow-request",
      target: "EchoObject", action: "Echo", payload: {}
    });
    await started;
    const reply = once(h.channel.port2, "message");
    h.channel.port2.postMessage({
      protocol: "cluster.rpc/1", direction: "plugin-to-host",
      type: "request", requestId: "too-many",
      target: "EchoObject", action: "Echo", payload: {}
    });
    const [denied] = await within(reply, "overload response");
    assert.equal(denied.requestId, "too-many");
    assert.equal(denied.status, 429);
    assert.equal(denied.error.code, "RPC_BACKPRESSURE");
    finish({ ok: true, status: 200, value: {} });
  } finally {
    h.adapter.detachAll();
    h.channel.port2.close();
  }
});


test("PR24.8 expired Host work sends one correlated 504, never late 200",
  async () => {
    const h = setup();
    try {
      const [hello] = await h.hello;
      h.channel.port2.postMessage({
        kind: "cluster-session-ready",
        protocol: hello.protocol, challenge: hello.challenge
      });
      let finish;
      let markStart;
      const started = new Promise(resolve => { markStart = resolve; });
      h.core.hub.request = () => new Promise(resolve => {
        finish = resolve;
        markStart();
      });
      const packets = [];
      h.channel.port2.on("message", packet => packets.push(packet));
      const response = once(h.channel.port2, "message");
      h.channel.port2.postMessage({
        protocol: "cluster.rpc/1", direction: "plugin-to-host",
        type: "request", requestId: "expires-on-host",
        target: "EchoObject", action: "Echo", payload: {},
        deadlineMs: 40
      });
      await within(started, "slow Host started");
      const [expired] = await within(response, "explicit Host timeout");
      assert.equal(expired.requestId, "expires-on-host");
      assert.equal(expired.status, 504);
      assert.equal(expired.error.code, "RPC_TIMEOUT");
      assert.ok(Number.isSafeInteger(expired.eventId));
      finish({ ok: true, status: 200, value: { secret: "late" } });
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(packets.length, 1);
      assert.equal(h.adapter.connections.get(h.channel.port1).inflight, 0);
      assert.ok(h.core.omu.snapshot().logs.some(event =>
        event.action === "RPC.DeadlineExceeded" &&
        event.status === 504));
    } finally {
      h.adapter.detachAll();
      h.channel.port2.close();
    }
  });

test("PR24.8 rotating an in-flight Session rejects old reply and leaks no listener",
  async () => {
    const h = setup();
    try {
      const [hello] = await h.hello;
      h.channel.port2.postMessage({
        kind: "cluster-session-ready",
        protocol: hello.protocol, challenge: hello.challenge
      });
      let finishOld;
      let markStart;
      const started = new Promise(resolve => { markStart = resolve; });
      h.core.hub.request = () => new Promise(resolve => {
        finishOld = resolve;
        markStart();
      });
      const responses = [];
      h.channel.port2.on("message", packet => {
        if (packet?.type === "response") responses.push(packet);
      });
      h.channel.port2.postMessage({
        protocol: "cluster.rpc/1", direction: "plugin-to-host",
        type: "request", requestId: "old-pending",
        target: "EchoObject", action: "Echo", payload: {},
        deadlineMs: 1500
      });
      await within(started, "old Host started");
      const notice = once(h.channel.port2, "message");
      assert.equal(h.adapter.suspend(h.channel.port1), true);
      assert.equal((await within(notice, "suspend"))[0].kind,
        "cluster-session-suspended");
      assert.equal(h.adapter.gateway.sessions.activeCount, 0);
      assert.equal(h.channel.port1.listenerCount("message"), 0);

      const rekey = once(h.channel.port2, "message");
      const renewed = h.adapter.resume(h.channel.port1,
        "example.provider");
      assert.equal(renewed.status, 201);
      const [freshHello] = await within(rekey, "rekey challenge");
      assert.notEqual(freshHello.sessionId, hello.sessionId);
      h.channel.port2.postMessage({
        kind: "cluster-session-ready",
        protocol: freshHello.protocol, challenge: freshHello.challenge
      });
      assert.equal(h.channel.port1.listenerCount("message"), 1);
      h.core.hub.request = async () => ({
        ok: true, status: 200, value: { echoed: "fresh" }
      });
      const freshResponse = once(h.channel.port2, "message");
      h.channel.port2.postMessage({
        protocol: "cluster.rpc/1", direction: "plugin-to-host",
        type: "request", requestId: "new-pending",
        target: "EchoObject", action: "Echo", payload: {}
      });
      const [answer] = await within(freshResponse, "new Host response");
      assert.equal(answer.data.echoed, "fresh");
      finishOld({ ok: true, status: 200,
        value: { secret: "old-session" } });
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(responses.map(packet => packet.requestId),
        ["new-pending"]);
      assert.equal(h.adapter.connections.get(h.channel.port1).inflight, 0);
      assert.ok(h.core.omu.snapshot().logs.some(event =>
        event.action === "RPC.DiscardedAfterRevoke"));
    } finally {
      h.adapter.detachAll();
      assert.equal(h.channel.port1.listenerCount("message"), 0);
      h.channel.port2.close();
    }
  });
