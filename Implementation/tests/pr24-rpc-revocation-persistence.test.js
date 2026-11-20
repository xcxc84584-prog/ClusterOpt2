import test from "node:test";
import assert from "node:assert/strict";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";
import { PluginHostInstallUnit } from
  "../LinkCore/PluginHostInstallUnit.js";
import { PluginRPCRevocationStoreUnit } from
  "../LinkCore/PluginRPCRevocationStoreUnit.js";

const REVOKED = Object.freeze({
  target: "UICO", action: "describe"
});
const RETAINED = Object.freeze({
  target: "HubUnit", action: "Property.Read", property: "Language"
});
const SCOPES = Object.freeze([REVOKED, RETAINED]);

function snapshot() {
  const manifest = {
    packageVersion: 1, name: "Denial persistence test",
    entry: "worker.js", rpcScopes: SCOPES,
    provider: {
      manifestVersion: 1,
      providerId: "plugin.persist", objectId: "PluginPersist",
      provides: [{
        service: "example.persist", action: "probe",
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

function store(memory = new Map(), failOnMark = false,
  failOnClear = false) {
  return {
    async list(providerId) {
      return { ok: true, status: 200,
        value: memory.get(providerId) ?? [] };
    },
    async mark(providerId, scope) {
      if (failOnMark) return { ok: false, status: 503 };
      const scopes = memory.get(providerId) ?? [];
      memory.set(providerId, [...scopes, scope]);
      return { ok: true, status: 201 };
    },
    async clear(providerId, scope) {
      if (failOnClear) return { ok: false, status: 503 };
      const scopes = memory.get(providerId) ?? [];
      memory.set(providerId, scopes.filter(item =>
        item.target !== scope.target ||
        item.action !== scope.action ||
        item.property !== scope.property));
      return { ok: true, status: 200 };
    }
  };
}

function environment(denials) {
  const env = new VirtualTestEnvironment();
  const bridges = [];
  const installer = new PluginHostInstallUnit(env.core, null, () => {
    const bridge = {
      closed: false,
      scopes: Object.freeze([]),
      pendingCount: 0,
      async start() { return { ok: true, status: 200 }; },
      enableHostRequests(_core, active, reviewed = active) {
        this.scopes = active;
        this.reviewed = reviewed;
        return { ok: true, status: 201 };
      },
      listHostRPCScopes() { return this.scopes; },
      suspendHostRequests() { this.suspended = true; return true; },
      resumeHostRequests() {
        this.suspended = false;
        return { ok: true, status: 201 };
      },
      grantReviewedHostRPCScope(scope) {
        if (!this.reviewed.some(item =>
          item.target === scope.target &&
          item.action === scope.action &&
          item.property === scope.property)) {
          return { ok: false, status: 403 };
        }
        if (this.scopes.some(item =>
          item.target === scope.target &&
          item.action === scope.action &&
          item.property === scope.property)) {
          return { ok: false, status: 409 };
        }
        this.scopes = Object.freeze([...this.scopes, scope]);
        return { ok: true, status: 200 };
      },
      revokeHostRPCScope(scope) {
        const before = this.scopes.length;
        this.scopes = Object.freeze(this.scopes.filter(item =>
          item.target !== scope.target ||
          item.action !== scope.action ||
          item.property !== scope.property));
        return before === this.scopes.length ?
          { ok: false, status: 404 } :
          { ok: true, status: 200 };
      },
      pendingHostRequestCount() { return this.pendingCount; },
      async invoke() {
        return { ok: true, status: 200, value: {} };
      },
      terminate() { this.closed = true; }
    };
    bridges.push(bridge);
    return bridge;
  }, denials);
  return { env, installer, bridges };
}

const APPROVAL = Object.freeze({
  consented: true, approvedRpcScopes: SCOPES
});

test("PR24.46 durable deny survives completely new Host/Installer",
  async () => {
    const shared = store();
    const first = environment(shared);
    assert.equal((await first.installer.install(
      snapshot(), APPROVAL)).status, 201);
    assert.deepEqual(first.installer.listRpcScopes(
      "plugin.persist"), SCOPES);
    assert.equal((await first.installer.revokeRpcScopePersisted(
      "plugin.persist", REVOKED)).status, 200);
    assert.deepEqual(first.installer.listRpcScopes(
      "plugin.persist"), [RETAINED]);
    assert.equal(first.installer.uninstall("plugin.persist").status, 200);

    // Same persisted records, but a different URU, Installer and Worker.
    const next = environment(shared);
    assert.equal((await next.installer.install(
      snapshot(), APPROVAL)).status, 201);
    assert.deepEqual(next.installer.listRpcScopes(
      "plugin.persist"), [RETAINED]);
    assert.ok(next.env.log().some(entry =>
      entry.action === "Plugin.Install.RPCPersistedDenyApplied"));
    assert.equal(next.installer.uninstall("plugin.persist").status, 200);
  });

test("PR24.46 storage failure disables Provider rather than reporting success",
  async () => {
    const h = environment(store(new Map(), true));
    assert.equal((await h.installer.install(
      snapshot(), APPROVAL)).status, 201);
    const denied = await h.installer.revokeRpcScopePersisted(
      "plugin.persist", REVOKED);
    assert.equal(denied.status, 503);
    assert.equal(h.env.core.uru.disabledProviders.has(
      "plugin.persist"), true);
    assert.deepEqual(h.installer.listRpcScopes(
      "plugin.persist"), [RETAINED]);
    assert.ok(h.env.log().some(entry =>
      entry.action === "Plugin.Install.RPCRevokePersistenceFailed"));
  });

test("PR24.76 reverse in-flight request blocks upgrade before unregister",
  async () => {
    const h = environment(store());
    assert.equal((await h.installer.install(
      snapshot(), APPROVAL)).status, 201);
    const original = h.installer.handles.get("plugin.persist");
    original.pendingCount = 1;
    const busy = await h.installer.upgrade(
      "plugin.persist", snapshot(), APPROVAL);
    assert.equal(busy.status, 409);
    assert.equal(original.closed, false);
    assert.equal(h.installer.handles.get("plugin.persist"), original);
    assert.equal(h.env.core.uru.getProvider(
      "plugin.persist").objectId, "PluginPersist");
    assert.ok(h.env.log().some(entry =>
      entry.action === "Plugin.Install.UpgradeBusy"));
    original.pendingCount = 0;
    assert.equal(h.installer.uninstall("plugin.persist").status, 200);
  });

test("PR24.46 persist store rejects malformed records before IO",
  async () => {
    const denied = new PluginRPCRevocationStoreUnit(null, null);
    assert.equal((await denied.mark("bad provider", REVOKED)).status, 400);
    assert.equal((await denied.mark(
      "plugin.persist", { target: "*", action: "describe" })).status, 400);
    assert.equal((await denied.list("bad provider")).status, 400);
    assert.equal((await denied.list("plugin.persist")).status, 503);
  });

test("PR24.47 explicit reapproval requires consent and restores only one",
  async () => {
    const shared = store();
    const h = environment(shared);
    const providerId = "plugin.persist";
    assert.equal((await h.installer.install(
      snapshot(), APPROVAL)).status, 201);
    assert.equal((await h.installer.revokeRpcScopePersisted(
      providerId, REVOKED)).status, 200);
    assert.equal((await h.installer.reapproveRpcScope(
      providerId, REVOKED)).status, 403);
    assert.deepEqual(h.installer.listRpcScopes(providerId), [RETAINED]);
    assert.deepEqual((await h.installer.listRevokedRpcScopes(
      providerId)).value, [REVOKED]);

    const bridge = h.installer.handles.get(providerId);
    const restored = await h.installer.reapproveRpcScope(
      providerId, REVOKED, { consented: true });
    assert.equal(restored.status, 200);
    assert.equal(bridge.suspended, false);
    assert.deepEqual(h.installer.listRpcScopes(
      providerId), [RETAINED, REVOKED]);
    assert.deepEqual((await h.installer.listRevokedRpcScopes(
      providerId)).value, []);
    assert.ok(h.env.log().some(entry =>
      entry.action === "Plugin.Install.RPCReapproved"));
    h.installer.uninstall(providerId);
  });

test("PR24.47 reapproval rolls back memory grant if store clear fails",
  async () => {
    const h = environment(store(new Map(), false, true));
    const providerId = "plugin.persist";
    assert.equal((await h.installer.install(
      snapshot(), APPROVAL)).status, 201);
    assert.equal((await h.installer.revokeRpcScopePersisted(
      providerId, REVOKED)).status, 200);
    const declined = await h.installer.reapproveRpcScope(
      providerId, REVOKED, { consented: true });
    assert.equal(declined.status, 503);
    assert.deepEqual(h.installer.listRpcScopes(providerId), [RETAINED]);
    assert.deepEqual((await h.installer.listRevokedRpcScopes(
      providerId)).value, [REVOKED]);
    assert.equal(h.installer.handles.get(providerId).suspended, false);
    h.installer.uninstall(providerId);
  });

test("PR24.49 only originally reviewed route can be reapproved",
  async () => {
    const shared = store(new Map([
      ["plugin.persist", [{
        target: "UICO", action: "other"
      }]]
    ]));
    const h = environment(shared);
    assert.equal((await h.installer.install(
      snapshot(), APPROVAL)).status, 201);
    const denied = await h.installer.reapproveRpcScope(
      "plugin.persist", { target: "UICO", action: "other" },
      { consented: true });
    assert.equal(denied.status, 403);
    assert.deepEqual(h.installer.listRpcScopes(
      "plugin.persist"), SCOPES);
    assert.deepEqual((await shared.list("plugin.persist")).value, [
      { target: "UICO", action: "other" }
    ]);
    h.installer.uninstall("plugin.persist");
  });

test("PR24.47 post-reload reviewed route is not active until new consent",
  async () => {
    const shared = store(new Map([
      ["plugin.persist", [REVOKED]]
    ]));
    const h = environment(shared);
    assert.equal((await h.installer.install(
      snapshot(), APPROVAL)).status, 201);
    assert.deepEqual(h.installer.listRpcScopes(
      "plugin.persist"), [RETAINED]);
    const bridge = h.installer.handles.get("plugin.persist");
    assert.deepEqual(bridge.reviewed, SCOPES);
    assert.equal((await h.installer.reapproveRpcScope(
      "plugin.persist", REVOKED)).status, 403);
    assert.equal((await h.installer.reapproveRpcScope(
      "plugin.persist", REVOKED, { consented: true })).status, 200);
    assert.deepEqual(h.installer.listRpcScopes(
      "plugin.persist"), [RETAINED, REVOKED]);
    assert.deepEqual((await shared.list("plugin.persist")).value, []);
    h.installer.uninstall("plugin.persist");
  });
