import test from "node:test";
import assert from "node:assert/strict";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";
import { PluginHostInstallUnit } from
  "../LinkCore/PluginHostInstallUnit.js";
import { PluginRestartCircuitPolicy as Restart } from
  "../property/PluginRestartCircuitPolicy.js";

function packageFor(providerId, objectId) {
  const manifest = {
    packageVersion: 1, name: "Restart safety fixture",
    entry: "worker.js",
    provider: {
      manifestVersion: 1, providerId, objectId,
      provides: [{
        service: providerId + ".probe", action: "probe",
        version: "1.0.0", inputSchema: { type: "object" },
        outputSchema: { type: "object" }
      }],
      requires: [], permissions: [],
      execution: { isolation: "worker", concurrency: "serial" }
    }
  };
  const raw = JSON.stringify(manifest);
  return {
    format: "cluster-plugin-folder", formatVersion: 1,
    manifestText: raw,
    files: {
      "plugin.json": btoa(raw),
      "worker.js": btoa("export function probe() { return {}; }")
    }
  };
}

function environment() {
  let now = 1000;
  const vte = new VirtualTestEnvironment();
  const bridges = [];
  const store = {
    async list() { return { ok: true, status: 200, value: [] }; },
    async mark() { return { ok: true, status: 201 }; }
  };
  const installer = new PluginHostInstallUnit(
    vte.core, null, () => {
      const bridge = {
        closed: false,
        async start() { return { ok: true, status: 200 }; },
        async invoke() {
          return { ok: true, status: 200, value: {} };
        },
        terminate() { this.closed = true; }
      };
      bridges.push(bridge);
      return bridge;
    }, store, () => now);
  return {
    vte, installer, bridges,
    now(value) { now = value; }
  };
}

test("PR24.85 policy enforces bounded failure windows and backoff",
  () => {
    const first = Restart.fault([], 1000);
    assert.equal(first.ok, true);
    assert.equal(first.open, false);
    assert.equal(first.retryAfterMs, 1500);
    assert.equal(Restart.status(first, 2499).status, 429);
    assert.equal(Restart.status(first, 2500).allowed, true);
    const second = Restart.fault(first.history, 2501);
    assert.equal(second.retryAfterMs, 6000);
    const third = Restart.fault(second.history, 8502);
    assert.equal(third.open, true);
    assert.equal(third.retryAfterMs, 60000);
    assert.equal(Restart.status(third, 8503).retryAfterMs, 59999);
    assert.equal(Restart.status(third, 68502).allowed, true);
    assert.equal(Restart.fault(new Array(4).fill(1), 1000).status, 400);
    assert.equal(Restart.fault([], NaN).status, 400);
    assert.equal(Restart.status(null, -1).status, 400);
    const expired = Restart.fault(third.history, 100000);
    assert.deepEqual(expired.history, [100000]);
    assert.equal(expired.open, false);
    assert.equal(Object.isFrozen(third.history), true);
  });

test("PR24.85 VTE crash backoff persists after uninstall and isolates peer",
  async () => {
    const h = environment();
    const provider = "example.restart.a";
    const snapshot = packageFor(provider, "ExampleRestartA");
    const consent = { consented: true };
    const install = () => h.installer.install(snapshot, consent);

    assert.equal((await install()).status, 201);
    const firstBridge = h.installer.handles.get(provider);
    firstBridge.closed = true;
    firstBridge.onFault(502, "InjectedCrash");
    assert.equal(h.vte.core.uru.disabledProviders.has(provider), true);
    assert.equal(h.installer.getRestartState(provider).retryAfterMs, 1500);
    assert.equal(h.installer.uninstall(provider).status, 200);
    assert.equal((await install()).status, 429);
    assert.equal(h.installer.handles.has(provider), false);

    h.now(2501);
    assert.equal((await install()).status, 201);
    h.installer.handles.get(provider).onFault(
      502, "InjectedCrash");
    assert.equal(h.installer.getRestartState(provider).retryAfterMs, 6000);
    assert.equal(h.installer.uninstall(provider).status, 200);
    assert.equal((await install()).status, 429);

    h.now(8502);
    assert.equal((await install()).status, 201);
    h.installer.handles.get(provider).onFault(
      502, "InjectedCrash");
    const circuit = h.installer.getRestartState(provider);
    assert.equal(circuit.open, true);
    assert.equal(circuit.status, 429);
    assert.equal(h.installer.uninstall(provider).status, 200);
    assert.equal((await install()).status, 429);

    // A different, otherwise valid third-party Provider still boots.
    const peer = await h.installer.install(packageFor(
      "example.restart.b", "ExampleRestartB"), consent);
    assert.equal(peer.status, 201);
    assert.equal(h.installer.getRestartState(
      "example.restart.b").allowed, true);
    assert.equal(h.installer.uninstall("example.restart.b").status, 200);

    assert.equal(h.installer.resetRestartCircuit(provider).status, 403);
    assert.equal(h.installer.resetRestartCircuit(provider, {
      consented: true
    }).status, 200);
    assert.equal(h.installer.getRestartState(provider).allowed, true);
    assert.equal((await install()).status, 201);
    assert.equal(h.installer.uninstall(provider).status, 200);
    assert.ok(h.vte.log().some(event =>
      event.action === "Plugin.Install.RestartCircuitOpened" &&
      event.kind === "EHU"));
    assert.ok(h.vte.log().some(event =>
      event.action === "Plugin.Install.RestartCircuitRejected" &&
      event.status === 429));
  });
