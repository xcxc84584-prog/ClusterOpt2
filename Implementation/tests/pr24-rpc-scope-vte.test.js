import test from "node:test";
import assert from "node:assert/strict";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";
import { PluginHostRequestGateway } from
  "../LinkCore/PluginHostRequestGateway.js";
import { PluginSessionUnit } from
  "../LinkCore/PluginSessionUnit.js";

/**
 * PR24 Patch(+10): exercise the real Hub/URU/EDPMU/OMU in a detached
 * VTE rather than only replacing HubUnit with a mock.
 */
test("PR24.50 VTE Property scope revoke preserves EDPMU and OMU", async () => {
  const env = new VirtualTestEnvironment();
  const { core } = env;
  const objectId = "PluginScopeVTE";
  assert.equal(core.register({
    id: objectId, strictOCDA: true,
    authorization: { default: "Public" },
    ocda: {
      EHU: [], Log: [], Request: ["probe"], Response: [],
      UserAPI: ["probe"], AgentAPI: [], Property: [],
      Program: "ScopeVTE"
    },
    receive: async () => ({})
  }), true);
  const provider = {
    manifestVersion: 1, providerId: "pr24.scope.vte",
    objectId,
    provides: [{
      service: "example.pr24.scope.vte", action: "probe",
      version: "1.0.0",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" }
    }],
    requires: [], permissions: [],
    execution: { isolation: "worker", concurrency: "serial" }
  };
  assert.equal(core.registerProvider(objectId, provider).status, 201);
  const version = {
    target: "HubUnit", action: "Property.Read",
    property: "SystemVersion"
  };
  const language = {
    target: "HubUnit", action: "Property.Read",
    property: "Language"
  };
  let sequence = 0;
  const gateway = new PluginHostRequestGateway(core,
    new PluginSessionUnit(() => "vte-" + ++sequence),
    [version, language]);
  const port = {
    sent: [],
    postMessage(packet) { this.sent.push(packet); },
    close() {}
  };
  const installed = gateway.create(port, provider.providerId);
  assert.equal(installed.status, 201);
  assert.equal(gateway.ready(port, {
    kind: "cluster-session-ready", protocol: "cluster.rpc/1",
    challenge: port.sent[0].challenge
  }).status, 200);
  const call = (id, property) => gateway.receive(port, {
    protocol: "cluster.rpc/1", direction: "plugin-to-host",
    type: "request", requestId: id,
    target: "HubUnit", action: "Property.Read",
    payload: { name: property }
  });
  const first = await call("version-before", "SystemVersion");
  assert.equal(first.value.status, 200);
  assert.equal(typeof first.value.data, "string");
  assert.equal(gateway.revokeRpcScope(version).status, 200);
  const denied = await call("version-after", "SystemVersion");
  assert.equal(denied.value.status, 403);
  const remaining = await call("language-after", "Language");
  assert.equal(remaining.value.status, 200);
  assert.equal(remaining.value.data, "zh-Hant");
  assert.ok(env.log().some(item => item.kind === "EHU" &&
    item.action === "RPC.ScopeRejected" &&
    item.details.requestId === "version-after"));
  assert.ok(env.log().some(item =>
    item.action === "Property.Read" && item.source === objectId &&
    item.status === 200));
  gateway.revokeProvider(provider.providerId);
  assert.equal(gateway.sessions.activeCount, 0);
  core.unregisterProvider(objectId, provider.providerId);
  core.unregister(objectId);
});
