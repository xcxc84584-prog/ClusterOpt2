import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { PluginManagerUnit } from
  "../LinkCore/PluginManagerUnit.js";

function fixture() {
  const core = new LinkCore();
  const owner = {
    id: "PMUTestOwner",
    authorization: { echo: "Public" },
    receive: async (action, payload) =>
      action === "echo" ? payload : null,
    ocda: { Request: ["echo"], Response: [],
      UserAPI: ["echo"], AgentAPI: [], Property: [],
      Program: {}, EHU: [], Log: [] }
  };
  const target = {
    id: "PMUTestTarget",
    authorization: { echo: "Public" },
    receive: async (_, payload) => payload,
    ocda: { Request: ["echo"], Response: [],
      UserAPI: ["echo"], AgentAPI: [], Property: [],
      Program: {}, EHU: [], Log: [] }
  };
  assert.equal(core.register(owner), true);
  assert.equal(core.register(target), true);
  const added = core.registerProvider("PMUTestOwner", {
    manifestVersion: 1, providerId: "vendor.pmu",
    objectId: "PMUTestOwner",
    provides: [{ service: "test.pmu.echo", action: "echo",
      version: "1.0.0", inputSchema: { type: "object" },
      outputSchema: { type: "object" } }],
    requires: [], permissions: ["document.slice.read"],
    execution: { isolation: "worker", concurrency: "serial" }
  });
  assert.equal(added.status, 201);
  return { core, pmu: core.pluginManagerUnit,
    channel: core.pluginManagerUnit.bind("vendor.pmu") };
}

test("PR23.1 PMU contains OCU PCU UCU and three bound channels", () => {
  const { core, pmu, channel } = fixture();
  assert.ok(pmu instanceof PluginManagerUnit);
  assert.deepEqual(Object.keys(channel),
    ["permission", "request", "response"]);
  assert.equal(Object.isFrozen(channel), true);
  assert.equal(typeof pmu.OCU.registrar.resolve, "function");
  assert.equal(typeof pmu.OCU.bridge.request, "function");
  assert.equal(typeof pmu.OCU.permissions.allows, "function");
  assert.equal(typeof pmu.OCU.forwarder.dispatch, "function");
  assert.equal(typeof pmu.PCU.registrar.resolve, "function");
  assert.equal(typeof pmu.PCU.bridge.read, "function");
  assert.equal(typeof pmu.PCU.permissions.allows, "function");
  assert.equal(typeof pmu.PCU.forwarder.dispatch, "function");
  assert.equal(typeof pmu.UCU.registrar.resolve, "function");
  assert.equal(typeof pmu.UCU.bridge.open, "function");
  assert.equal(typeof pmu.UCU.permissions.allows, "function");
  assert.equal(typeof pmu.UCU.forwarder.dispatch, "function");
  assert.equal(core.hub, pmu.core.hub);
});

test("PR23.1 permission request does not self-approve", () => {
  const { core, pmu, channel } = fixture();
  assert.equal(channel.permission({
    permission: "document.slice.read", approved: true
  }).status, 202);
  assert.equal(core.checkPluginPermission(
    "vendor.pmu", "document.slice.read"), false);
  assert.equal(pmu.grantFromHost(
    "vendor.pmu", "document.slice.read").status, 403);
  assert.equal(pmu.grantFromHost(
    "vendor.pmu", "document.slice.read", true).status, 200);
  assert.equal(channel.permission({
    permission: "document.slice.read"
  }).value.granted, true);
  assert.equal(channel.permission({
    permission: "route.configure"
  }).status, 403);
});

test("PR23.1 OCU bridges HubUnit guarded object and service calls",
  async () => {
    const { channel } = fixture();
    const direct = await channel.request({
      unit: "OCU", target: "PMUTestTarget",
      action: "echo", payload: { message: "hello" }
    });
    assert.deepEqual(direct.value, { message: "hello" });
    const service = await channel.request({
      unit: "OCU", service: "test.pmu.echo",
      action: "echo", payload: { n: 123 }
    });
    assert.deepEqual(service.value, { n: 123 });
    assert.equal((await channel.request({
      unit: "OCU", target: "Missing", action: "echo"
    })).status, 404);
    assert.equal((await channel.request({
      unit: "OCU", target: "PMUTestTarget", action: "echo",
      permission: "document.slice.read"
    })).status, 403);
  });

test("PR23.1 PCU reuses HubUnit Property ACL, rejects unauthorized write",
  async () => {
    const { core, channel } = fixture();
    assert.equal(core.hub.registerProperty("PMUTestPublic", "ok", {
      owners: ["PMUTestOwner"], visibility: "Public",
      readOnly: true
    }).status, 201);
    const read = await channel.request({
      unit: "PCU", action: "read", name: "PMUTestPublic"
    });
    assert.deepEqual(read, { ok: true, status: 200, value: "ok" });
    const denied = await channel.request({
      unit: "PCU", action: "publish", name: "PMUTestPublic",
      value: "changed"
    });
    assert.equal(denied.status, 403);
    assert.equal(core.edpmu.get("PMUTestPublic"), "ok");
  });

test("PR23.1 UCU only controls its own already mounted view",
  async () => {
    const { core, channel } = fixture();
    assert.equal((await channel.request({
      unit: "UCU", action: "open"
    })).status, 404);
    let pressed = null;
    const view = { enabled: true, panel: { hidden: true },
      button: { setAttribute: (_, value) => { pressed = value; } } };
    core.pluginHostInstaller.uiHost.views.set("vendor.pmu", view);
    assert.equal((await channel.request({
      unit: "UCU", action: "open"
    })).value.visible, true);
    assert.equal(view.panel.hidden, false);
    assert.equal(pressed, "true");
    assert.equal((await channel.request({
      unit: "UCU", action: "close"
    })).value.visible, false);
    assert.equal(view.panel.hidden, true);
    assert.equal((await channel.request({
      unit: "UCU", action: "state"
    })).value.visible, false);
    assert.equal((await core.pluginManagerUnit.bind("unknown")
      .request({ unit: "UCU", action: "open" })).status, 403);
  });

test("PR23.1 response channel prevents unsolicited and cross-provider REP",
  () => {
    const { pmu, channel } = fixture();
    assert.equal(channel.response({
      requestId: "arbitrary", value: "bad"
    }).status, 403);
    let observed = null;
    const p = pmu.expectResponse("vendor.pmu", value => {
      observed = value;
    });
    assert.equal(p.status, 200);
    assert.equal(pmu.bind("other").response({
      requestId: p.value.requestId, value: "bad"
    }).status, 403);
    assert.equal(channel.response({
      requestId: p.value.requestId, value: { result: "ok" }
    }).status, 200);
    assert.deepEqual(observed, { result: "ok" });
    assert.equal(channel.response({
      requestId: p.value.requestId, value: "replay"
    }).status, 403);
  });

test("PR23.1 retired provider and malformed messages are denied",
  async () => {
    const { core, channel } = fixture();
    assert.equal((await channel.request({
      unit: "BAD", action: "echo"
    })).status, 400);
    assert.equal((await channel.request({
      unit: "OCU", target: "PMUTestTarget",
      service: "test.pmu.echo", action: "echo"
    })).status, 400);
    const attack = JSON.parse('{"unit":"OCU","__proto__":{}}');
    assert.equal((await channel.request(attack)).ok, false);
    core.unregisterProvider("PMUTestOwner", "vendor.pmu");
    assert.equal((await channel.request({
      unit: "OCU", target: "PMUTestTarget", action: "echo"
    })).status, 403);
  });
