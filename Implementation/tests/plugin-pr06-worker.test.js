import test from "node:test";
import assert from "node:assert/strict";
import { PluginSourcePolicy } from
  "../property/PluginSourcePolicy.js";
import { TrustedPluginWorkerUnit } from
  "../LinkCore/TrustedPluginWorkerUnit.js";
import { LinkCore } from "../LinkCore/LinkCore.js";

function fakeWorker(reply) {
  let terminated = false;
  return {
    postMessage(packet) {
      queueMicrotask(() => {
        if (!terminated) this.onmessage?.({ data: reply(packet) });
      });
    },
    terminate() { terminated = true; },
    get ended() { return terminated; }
  };
}

test("PR06.04 source policy rejects external or injected Worker URLs", () => {
  assert.equal(PluginSourcePolicy.inspect({ kind: "builtin" })
    .status, 200);
  for (const value of [
    { kind: "remote" }, { kind: "builtin", url: "/plugin.js" },
    { kind: "builtin", code: "eval" }, { kind: "blob" },
    { kind: "https" }, { kind: "builtin", constructor: 1 },
    Object.defineProperty({}, "kind", {
      get() { throw Error("unsafe getter"); }, enumerable: true
    })
  ]) {
    assert.equal(PluginSourcePolicy.inspect(value).ok, false);
  }
});

test("PR06.03 Worker transport validates answer and records Log", async () => {
  const core = new LinkCore();
  const adapter = new TrustedPluginWorkerUnit(core.omu,
    () => fakeWorker(packet => ({
      id: packet.id, ok: true, value: packet.payload
    })));
  const input = { nested: { count: 3 } };
  const response = await adapter.invoke("echo", input);
  input.nested.count = 9;
  assert.equal(response.status, 200);
  assert.equal(response.value.nested.count, 3);
  assert.equal(adapter.active, 0);
  assert.ok(core.getSnapshot().logs.some(event =>
    event.action === "Plugin.Worker.Invoke" &&
    event.status === 200));
});

test("PR06.06 timeout terminates worker and releases capacity", async () => {
  const core = new LinkCore();
  let ended = false;
  const adapter = new TrustedPluginWorkerUnit(core.omu, () => ({
    postMessage() {},
    terminate() { ended = true; }
  }));
  const response = await adapter.invoke("echo", {}, { timeoutMs: 10 });
  assert.equal(response.status, 504);
  assert.equal(adapter.active, 0);
  assert.equal(ended, true);
  assert.ok(core.getSnapshot().logs.some(event =>
    event.kind === "EHU" && event.status === 504));
});

test("PR06.03/06 malformed and replayed response fail closed", async () => {
  const core = new LinkCore();
  const adapter = new TrustedPluginWorkerUnit(core.omu,
    () => fakeWorker(packet => ({
      id: packet.id + 1, ok: true, value: { bypass: true }
    })));
  assert.equal((await adapter.invoke("echo", {})).status, 502);
  assert.equal((await adapter.invoke("arbitrary", {})).status, 400);
  assert.equal((await adapter.invoke("echo", {},
    { timeoutMs: 5001 })).status, 400);
  assert.equal(adapter.active, 0);
});

test("PR06.03 host-only HubUnit Worker gate checks owner", async () => {
  const core = new LinkCore();
  const make = id => core.register({
    id, receive: async () => null,
    ocda: { Request: ["run"], Response: [],
      UserAPI: ["run"], AgentAPI: [], Property: [],
      Program: {}, EHU: [], Log: [] }
  });
  make("TrustedOwner"); make("OtherOwner");
  const manifest = {
    manifestVersion: 1, providerId: "test.builtin",
    objectId: "TrustedOwner",
    provides: [{ service: "test.worker", action: "run",
      version: "1.0.0", inputSchema: { type: "object" },
      outputSchema: { type: "object" } }],
    requires: [], permissions: [],
    execution: { isolation: "worker", concurrency: "serial" }
  };
  assert.equal(core.registerProvider("TrustedOwner", manifest)
    .status, 201);
  assert.equal((await core.invokeTrustedPluginWorker(
    "OtherOwner", "test.builtin", "echo", {})).status, 403);
  assert.equal((await core.invokeTrustedPluginWorker(
    "TrustedOwner", "missing.id", "echo", {})).status, 404);
  assert.equal((await core.invokeTrustedPluginWorker(
    "TrustedOwner", "test.builtin", "echo", {},
    { source: { kind: "remote" } })).status, 403);
});
