import test from "node:test";
import assert from "node:assert/strict";
import { PluginRPCScopePolicy as Scopes } from
  "../property/PluginRPCScopePolicy.js";
import { PluginPackageManifestPolicy as Package } from
  "../property/PluginPackageManifestPolicy.js";
import { PluginHostRequestGateway } from
  "../LinkCore/PluginHostRequestGateway.js";
import { PluginSessionUnit } from
  "../LinkCore/PluginSessionUnit.js";
import { describePluginRPCScopes } from
  "../main/plugin-rpc-scope-review.js";
import { ObjectManagementUnit } from
  "../LinkCore/ObjectManagementUnit.js";

const READ = Object.freeze({ target: "UICO", action: "describe" });
const PROPERTY = Object.freeze({
  target: "HubUnit", action: "Property.Read", property: "Language"
});

function packageText(scopes) {
  return JSON.stringify({
    packageVersion: 1, name: "Scope fixture", entry: "worker.js",
    provider: {
      manifestVersion: 1, providerId: "plugin.scope",
      objectId: "PluginScope", requires: [], permissions: [],
      provides: [{
        service: "plugin.scope.service", action: "transform",
        version: "1.0.0",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" }
      }],
      execution: { isolation: "worker", concurrency: "serial" }
    },
    rpcScopes: scopes
  });
}

function harness(approved) {
  let counter = 0;
  const requests = [];
  const properties = [];
  const provider = {
    providerId: "plugin.scope", objectId: "PluginScope",
    permissions: []
  };
  const core = {
    uru: {
      objects: new Map([[provider.objectId, {}]]),
      disabledProviders: new Set(),
      getProvider(id) {
        return id === provider.providerId ? provider : null;
      }
    },
    checkPluginPermission() { return true; },
    hub: {
      async request(source, target, action, payload) {
        requests.push({ source, target, action, payload });
        return { ok: true, status: 200, value: { allowed: true } };
      },
      readProperty(source, name) {
        properties.push({ source, name });
        if (name !== "Language") return { ok: false, status: 403 };
        return { ok: true, status: 200, value: "zh-Hant" };
      }
    },
    omu: new ObjectManagementUnit()
  };
  const port = {
    sent: [],
    postMessage(message) { this.sent.push(message); },
    close() {}
  };
  const gateway = new PluginHostRequestGateway(
    core, new PluginSessionUnit(() => "nonce-" + ++counter), approved);
  assert.equal(gateway.create(port, provider.providerId).status, 201);
  assert.equal(gateway.ready(port, {
    kind: "cluster-session-ready", protocol: "cluster.rpc/1",
    challenge: port.sent[0].challenge
  }).status, 200);
  const request = (id, target, action, payload = {}) => ({
    protocol: "cluster.rpc/1", direction: "plugin-to-host",
    type: "request", requestId: id, target, action, payload
  });
  return { gateway, port, core, requests, properties, request };
}

test("PR24.41 scope declaration forbids prefix/wildcard and prototype tricks",
  () => {
    assert.equal(Scopes.inspect([READ, PROPERTY]).ok, true);
    assert.equal(Scopes.inspect([, READ]).status, 400);
    const sparse = new Array(1);
    assert.equal(Scopes.inspect(sparse).status, 400);
    const extra = [READ];
    extra.custom = "unreviewed";
    assert.equal(Scopes.inspect(extra).status, 400);
    assert.equal(Scopes.inspect([READ, READ]).status, 400);
    assert.equal(Scopes.inspect([{
      target: "UICO.*", action: "describe"
    }]).status, 400);
    assert.equal(Scopes.inspect([{
      target: "HubUnit", action: "Property.Read"
    }]).status, 400);
    assert.equal(Scopes.inspect([{
      target: "HubUnit", action: "Property.Write",
      property: "Language"
    }]).status, 400);
    assert.equal(Scopes.inspect([{
      target: "UICO", action: "describe", property: "Language"
    }]).status, 400);
    let ran = false;
    const poison = {};
    Object.defineProperty(poison, "target", {
      enumerable: true,
      get() { ran = true; return "UICO"; }
    });
    assert.equal(Scopes.inspect([poison]).status, 400);
    assert.equal(ran, false);
    assert.equal(Scopes.inspect(Array.from({ length: 33 }, (_, i) => ({
      target: "Target" + i, action: "Read"
    }))).status, 400);
  });

test("PR24.42 package declares scopes but cannot self-approve them",
  () => {
    const parsed = Package.validate(packageText([READ, PROPERTY]));
    assert.equal(parsed.ok, true);
    assert.equal(Object.isFrozen(parsed.value.rpcScopes), true);
    assert.equal(Scopes.review(parsed.value.rpcScopes, []).status, 403);
    assert.equal(Scopes.review(parsed.value.rpcScopes,
      [READ, { ...PROPERTY, property: "UI_COLOR" }]).status, 403);
    assert.equal(Scopes.review(parsed.value.rpcScopes,
      [READ, PROPERTY]).ok, true);
    assert.equal(Package.validate(packageText([{
      target: "HubUnit", action: "Property.Delete",
      property: "Language"
    }])).status, 400);
  });

test("PR24.43 no approved scope blocks even a Public action", async () => {
  const h = harness([]);
  const result = await h.gateway.receive(h.port,
    h.request("deny-public", "UICO", "describe"));
  assert.equal(result.value.status, 403);
  assert.equal(result.value.error.code, "REQUEST_DENIED");
  assert.equal(h.requests.length, 0);
  assert.ok(h.core.omu.snapshot().logs.some(entry =>
    entry.kind === "EHU" && entry.action === "RPC.ScopeRejected"));
});

test("PR24.44 exact Object/Action scope allows only that route",
  async () => {
    const h = harness([READ]);
    const allowed = await h.gateway.receive(h.port,
      h.request("read", "UICO", "describe"));
    assert.equal(allowed.value.status, 200);
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].source, "PluginScope");
    const otherAction = await h.gateway.receive(h.port,
      h.request("other", "UICO", "extensionAPI"));
    assert.equal(otherAction.value.status, 403);
    const otherObject = await h.gateway.receive(h.port,
      h.request("foreign", "UICO.editor", "describe"));
    assert.equal(otherObject.value.status, 403);
    assert.equal(h.requests.length, 1);
  });

test("PR24.45 Property.Read uses exact scope and HubUnit visibility gate",
  async () => {
    const h = harness([PROPERTY]);
    const allowed = await h.gateway.receive(h.port,
      h.request("lang", "HubUnit", "Property.Read",
        { name: "Language" }));
    assert.equal(allowed.value.status, 200);
    assert.equal(allowed.value.data, "zh-Hant");
    assert.deepEqual(h.properties, [
      { source: "PluginScope", name: "Language" }
    ]);
    const denied = await h.gateway.receive(h.port,
      h.request("other-property", "HubUnit", "Property.Read",
        { name: "UI_COLOR" }));
    assert.equal(denied.value.status, 403);
    const extra = await h.gateway.receive(h.port,
      h.request("forged-property", "HubUnit", "Property.Read",
        { name: "Language", override: true }));
    assert.equal(extra.value.status, 403);
    assert.equal(h.properties.length, 1);
    assert.equal(h.requests.length, 0);
  });

test("PR24.46 consent UI renders exact target/action/property scopes",
  () => {
    const translate = (_zh, en) => en;
    assert.equal(describePluginRPCScopes([], translate), "None");
    const text = describePluginRPCScopes([READ, PROPERTY], translate);
    assert.ok(text.includes("UICO / describe"));
    assert.ok(text.includes("HubUnit / Property.Read [Language]"));
    assert.equal(text.includes("UI_COLOR"), false);
  });

test("PR24.47 host revokes one exact scope and never grants implicitly",
  async () => {
    const h = harness([READ, PROPERTY]);
    const scopes = h.gateway.listRpcScopes();
    assert.equal(Object.isFrozen(scopes), true);
    assert.equal(Object.isFrozen(scopes[0]), true);
    assert.equal(h.gateway.revokeRpcScope({
      target: "UICO", action: "extensionAPI"
    }).status, 404);
    assert.equal(h.gateway.revokeRpcScope({
      target: "UICO.*", action: "describe"
    }).status, 400);
    assert.equal(h.gateway.revokeRpcScope(READ).status, 200);
    assert.equal(h.gateway.revokeRpcScope(READ).status, 404);
    assert.deepEqual(h.gateway.listRpcScopes(), [PROPERTY]);
    assert.deepEqual(scopes, [READ, PROPERTY]);
    const denied = await h.gateway.receive(h.port,
      h.request("read-after-revoke", "UICO", "describe"));
    assert.equal(denied.value.status, 403);
    assert.equal(h.requests.length, 0);
    const unaffected = await h.gateway.receive(h.port,
      h.request("property-still-authorized", "HubUnit",
        "Property.Read", { name: "Language" }));
    assert.equal(unaffected.value.data, "zh-Hant");
    assert.equal(h.gateway.revokeRpcScope(PROPERTY).status, 200);
    assert.equal((await h.gateway.receive(h.port,
      h.request("property-revoked", "HubUnit",
        "Property.Read", { name: "Language" }))).value.status, 403);
    assert.ok(h.core.omu.snapshot().logs.some(entry =>
      entry.action === "RPC.ScopeRevoked" && entry.status === 200));
  });

test("PR24.48 revoked scope suppresses non-cooperative in-flight Host data",
  async () => {
    const h = harness([READ]);
    let finish;
    h.core.hub.request = () => new Promise(resolve => {
      finish = resolve;
    });
    const pending = h.gateway.receive(h.port,
      h.request("revoked-pending", "UICO", "describe"));
    assert.equal(typeof finish, "function");
    assert.equal(h.gateway.revokeRpcScope(READ).status, 200);
    finish({ ok: true, status: 200,
      value: { confidential: "late response" } });
    const result = await pending;
    assert.equal(result.status, 499);
    assert.equal(result.value, undefined);
    assert.ok(h.core.omu.snapshot().logs.some(entry =>
      entry.action === "RPC.DiscardedAfterRevoke" &&
      entry.details.requestId === "revoked-pending"));
  });
