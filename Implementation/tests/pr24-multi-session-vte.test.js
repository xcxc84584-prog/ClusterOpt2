import test from "node:test";
import assert from "node:assert/strict";
import { MessageChannel } from "node:worker_threads";
import { ObjectManagementUnit } from
  "../LinkCore/ObjectManagementUnit.js";
import { PluginSessionUnit } from
  "../LinkCore/PluginSessionUnit.js";
import { PluginHostRequestGateway } from
  "../LinkCore/PluginHostRequestGateway.js";
import { PluginHostRequestTransport } from
  "../LinkCore/PluginHostRequestTransport.js";

const ROUTE_A = Object.freeze({ target: "RouteA", action: "Slow" });
const ROUTE_B = Object.freeze({ target: "RouteA", action: "Fast" });
const ROUTE_C = Object.freeze({ target: "RouteB", action: "Fast" });
const PROTOCOL = "cluster.rpc/1";

function makeCore() {
  const providers = new Map([
    ["provider.alpha", {
      providerId: "provider.alpha",
      objectId: "PluginAlpha", permissions: []
    }],
    ["provider.beta", {
      providerId: "provider.beta",
      objectId: "PluginBeta", permissions: []
    }]
  ]);
  const calls = [];
  const core = {
    uru: {
      objects: new Map([
        ["PluginAlpha", {}], ["PluginBeta", {}]
      ]),
      disabledProviders: new Set(),
      getProvider: id => providers.get(id) ?? null
    },
    checkPluginPermission: () => true,
    omu: new ObjectManagementUnit(() => Date.now()),
    hub: {
      async request(source, target, action, payload) {
        calls.push({ source, target, action, payload });
        return {
          ok: true, status: 200,
          value: { source, target, action, echo: payload.text ?? null }
        };
      }
    }
  };
  return { core, calls, providers };
}

function host(core, scopes, prefix = "multi") {
  let number = 0;
  const sessions = new PluginSessionUnit(() =>
    prefix + "-" + ++number);
  const gateway = new PluginHostRequestGateway(
    core, sessions, scopes);
  const transport = new PluginHostRequestTransport(gateway);
  return { gateway, transport, sessions };
}

function request(id, route, text = "") {
  return {
    protocol: PROTOCOL,
    direction: "plugin-to-host",
    type: "request", requestId: id,
    target: route.target, action: route.action,
    payload: { text }, deadlineMs: 2000
  };
}

function listen(channel) {
  const packets = [];
  const pending = [];
  channel.port2.on("message", packet => {
    const next = pending.find(entry => entry.match(packet));
    if (next) {
      pending.splice(pending.indexOf(next), 1);
      clearTimeout(next.timer);
      next.resolve(packet);
    } else {
      packets.push(packet);
    }
  });
  return {
    packets,
    wait(match = () => true, ms = 1500) {
      const index = packets.findIndex(match);
      if (index >= 0) {
        return Promise.resolve(packets.splice(index, 1)[0]);
      }
      return new Promise((resolve, reject) => {
        const entry = {
          match, resolve,
          timer: setTimeout(() => {
            pending.splice(pending.indexOf(entry), 1);
            reject(Error("No expected MessagePort response"));
          }, ms)
        };
        pending.push(entry);
      });
    },
    stop() {
      for (const entry of pending) clearTimeout(entry.timer);
      pending.length = 0;
    }
  };
}

async function connect(transport, providerId) {
  const channel = new MessageChannel();
  const observer = listen(channel);
  const attached = transport.attach(channel.port1, providerId);
  if (!attached.ok) {
    observer.stop();
    channel.port1.close();
    channel.port2.close();
    return { channel, observer, attached };
  }
  const hello = await observer.wait(p =>
    p.kind === "cluster-session-hello");
  channel.port2.postMessage({
    kind: "cluster-session-ready",
    protocol: hello.protocol,
    challenge: hello.challenge
  });
  return { channel, observer, attached, hello };
}

function cleanup(handles) {
  for (const { transport } of handles) transport.detachAll();
}

test("PR24.16 VTE two Worker Ports keep Session IDs and replay independent",
  async () => {
    const { core, calls } = makeCore();
    const h = host(core, [ROUTE_B], "alpha");
    const a = await connect(h.transport, "provider.alpha");
    const b = await connect(h.transport, "provider.alpha");
    try {
      assert.equal(a.attached.status, 201);
      assert.equal(b.attached.status, 201);
      assert.notEqual(a.hello.sessionId, b.hello.sessionId);
      assert.equal(h.sessions.activeCount, 2);
      // A foreign Provider is never allowed to reuse this Gateway's
      // authority, even though URU independently recognizes it.
      const foreign = new MessageChannel();
      try {
        assert.equal(h.transport.attach(foreign.port1,
          "provider.beta").status, 403);
        assert.equal(h.sessions.activeCount, 2);
        assert.ok(core.omu.snapshot().logs.some(entry =>
          entry.action === "RPC.ForeignProviderRejected" &&
          entry.status === 403));
      } finally {
        foreign.port1.close();
        foreign.port2.close();
      }
      const aReply = a.observer.wait(p => p.requestId === "shared-id");
      const bReply = b.observer.wait(p => p.requestId === "shared-id");
      a.channel.port2.postMessage(request(
        "shared-id", ROUTE_B, "from-A"));
      b.channel.port2.postMessage(request(
        "shared-id", ROUTE_B, "from-B"));
      const [x, y] = await Promise.all([aReply, bReply]);
      assert.equal(x.status, 200);
      assert.equal(y.status, 200);
      assert.equal(x.data.echo, "from-A");
      assert.equal(y.data.echo, "from-B");
      assert.equal(calls.length, 2);
      assert.ok(calls.every(call => call.source === "PluginAlpha"));

      // A replay on Port A cannot revoke or replay the independent B.
      a.channel.port2.postMessage(request(
        "shared-id", ROUTE_B, "replayed-A"));
      const rejected = await new Promise(resolve => {
        const check = () => resolve(h.sessions.inspect(
          a.channel.port1, request("shared-id", ROUTE_B)));
        setImmediate(check);
      });
      assert.equal(rejected.status, 409);
      const bStillWorks = b.observer.wait(p =>
        p.requestId === "new-B");
      b.channel.port2.postMessage(request(
        "new-B", ROUTE_B, "live-B"));
      assert.equal((await bStillWorks).status, 200);
      assert.equal(h.sessions.activeCount, 2);
      assert.equal(calls.length, 3);
    } finally {
      cleanup([h]);
      a.observer.stop();
      b.observer.stop();
      a.channel.port2.close();
      b.channel.port2.close();
    }
  });

test("PR24.19 VTE switched Provider Session cannot borrow old scopes",
  async () => {
    const { core, calls } = makeCore();
    const oldHost = host(core, [ROUTE_B], "before");
    const oldPort = await connect(oldHost.transport, "provider.alpha");
    try {
      const initial = oldPort.observer.wait(p =>
        p.requestId === "old-permission");
      oldPort.channel.port2.postMessage(request(
        "old-permission", ROUTE_B, "before-upgrade"));
      assert.equal((await initial).status, 200);
      assert.equal(oldHost.transport.detach(
        oldPort.channel.port1), true);
      assert.equal(oldHost.sessions.activeCount, 0);
      const newHost = host(core, [ROUTE_C], "after");
      const betaPort = await connect(
        newHost.transport, "provider.beta");
      try {
        assert.notEqual(
          betaPort.hello.sessionId, oldPort.hello.sessionId);
        const oldRoute = betaPort.observer.wait(p =>
          p.requestId === "old-route");
        betaPort.channel.port2.postMessage(request(
          "old-route", ROUTE_B, "attempted-borrow"));
        const forbidden = await oldRoute;
        assert.equal(forbidden.status, 403);
        assert.equal(forbidden.error.code, "REQUEST_DENIED");
        const newRoute = betaPort.observer.wait(p =>
          p.requestId === "new-route");
        betaPort.channel.port2.postMessage(request(
          "new-route", ROUTE_C, "new-provider"));
        const accepted = await newRoute;
        assert.equal(accepted.status, 200);
        assert.equal(accepted.data.source, "PluginBeta");
        assert.equal(calls.length, 2);
        assert.equal(calls[0].source, "PluginAlpha");
        assert.equal(calls[1].source, "PluginBeta");
        assert.ok(core.omu.snapshot().logs.some(item =>
          item.kind === "EHU" &&
          item.action === "RPC.ScopeRejected" &&
          item.details.requestId === "old-route"));
      } finally {
        newHost.transport.detachAll();
        betaPort.observer.stop();
        betaPort.channel.port2.close();
      }
    } finally {
      oldHost.transport.detachAll();
      oldPort.observer.stop();
      oldPort.channel.port2.close();
    }
  });

test("PR24.48 VTE one revocation cancels both Ports, no late disclosure",
  async () => {
    const { core } = makeCore();
    const h = host(core, [ROUTE_A, ROUTE_B], "revoke");
    const a = await connect(h.transport, "provider.alpha");
    const b = await connect(h.transport, "provider.alpha");
    const completions = [];
    let begun = 0;
    let bothStarted;
    const started = new Promise(resolve => { bothStarted = resolve; });
    const finish = [];
    core.hub.request = (_source, _target, action, payload) => {
      if (action === "Fast") {
        return Promise.resolve({
          ok: true, status: 200, value: { echo: payload.text }
        });
      }
      begun++;
      if (begun === 2) bothStarted();
      return new Promise(resolve => finish.push(resolve));
    };
    try {
      const aReply = a.observer.wait(p =>
        p.requestId === "slow-A");
      const bReply = b.observer.wait(p =>
        p.requestId === "slow-B");
      a.channel.port2.postMessage(request("slow-A", ROUTE_A));
      b.channel.port2.postMessage(request("slow-B", ROUTE_A));
      await started;
      const revoked = h.transport.revokeRpcScope(ROUTE_A);
      assert.equal(revoked.status, 200);
      assert.equal(revoked.cancelled, 2);
      const [x, y] = await Promise.all([aReply, bReply]);
      assert.equal(x.status, 403);
      assert.equal(y.status, 403);
      assert.equal(x.error.code, "RPC_SCOPE_REVOKED");
      assert.equal(y.error.code, "RPC_SCOPE_REVOKED");
      assert.equal(h.transport.connections.get(
        a.channel.port1).inflight, 1);
      assert.equal(h.transport.connections.get(
        b.channel.port1).inflight, 1);

      const aFast = a.observer.wait(p => p.requestId === "fast-A");
      const bFast = b.observer.wait(p => p.requestId === "fast-B");
      a.channel.port2.postMessage(request(
        "fast-A", ROUTE_B, "allowed-A"));
      b.channel.port2.postMessage(request(
        "fast-B", ROUTE_B, "allowed-B"));
      assert.equal((await aFast).data.echo, "allowed-A");
      assert.equal((await bFast).data.echo, "allowed-B");

      a.channel.port2.on("message", packet => {
        if (packet?.requestId === "slow-A") completions.push(packet);
      });
      b.channel.port2.on("message", packet => {
        if (packet?.requestId === "slow-B") completions.push(packet);
      });
      for (const resolve of finish) {
        resolve({ ok: true, status: 200,
          value: { confidential: "must-not-leak" } });
      }
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(completions, []);
      assert.equal(h.transport.connections.get(
        a.channel.port1).inflight, 0);
      assert.equal(h.transport.connections.get(
        b.channel.port1).inflight, 0);
      assert.equal(h.sessions.activeCount, 2);
      assert.equal(core.omu.snapshot().logs.filter(item =>
        item.action === "RPC.ScopeRevokedInflight" &&
        item.status === 403).length, 2);
    } finally {
      for (const resolve of finish) resolve({
        ok: true, status: 200, value: {}
      });
      cleanup([h]);
      a.observer.stop();
      b.observer.stop();
      a.channel.port2.close();
      b.channel.port2.close();
    }
  });
