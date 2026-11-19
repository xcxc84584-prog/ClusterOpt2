import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";

const uisp = {
  uiId: "editor", kind: "panel", parentId: "root",
  owner: "LinkCore", revision: 0,
  geometry: { space: "viewport", x: 0, y: 0,
    width: 600, height: 400 },
  appearance: {}, interaction: {}, accessibility: {}
};
const empty = { type: "object" };
const desc = {
  apiVersion: 1, id: "plugin.demo.run", owner: "plugin.demo",
  action: "run", version: "1.0.0", visibility: "Public",
  sideEffect: "none", inputSchema: empty, outputSchema: empty
};

test("PR23 Hub E2E denies before permission then logs CRUD", async () => {
  const core = new LinkCore();
  assert.equal(core.uiControl.registerHostSurface(uisp).status, 201);
  assert.equal(core.register({
    id: "plugin.demo", receive: async () => null,
    ocda: { Request: ["run"], Response: ["run"],
      UserAPI: ["run"], AgentAPI: ["run"], Property: [],
      Program: "Plugin", EHU: "LinkCore.OMU", Log: "LinkCore.OMU" }
  }), true);
  const permissions = [
    "ui.api.extension.add", "ui.api.extension.query",
    "ui.api.extension.update", "ui.api.extension.delete"
  ];
  const registered = core.registerProvider("plugin.demo", {
    manifestVersion: 1, providerId: "plugin.demo",
    objectId: "plugin.demo",
    provides: [{
      service: "plugin.demo.run", action: "run",
      version: "1.0.0", inputSchema: empty, outputSchema: empty
    }],
    requires: [], permissions,
    execution: { isolation: "worker", concurrency: "serial" }
  });
  assert.equal(registered.status, 201, JSON.stringify(registered));
  const payload = (operationCode, more = {}) => ({
    uiId: "editor", apiId: "plugin.demo.run",
    providerId: "plugin.demo", operationCode, descriptor: desc,
    ...more
  });
  const call = (operationCode, more = {}) =>
    core.request("plugin.demo", "UICO", "extensionAPI",
      payload(operationCode, more), { origin: "user" });

  const denied = await call("00");
  assert.equal(denied.status, 403);
  assert.ok(core.omu.snapshot().logs.some(log =>
    log.kind === "EHU" && log.status === 403));

  for (const permission of permissions) {
    assert.equal(core.grantPluginPermission(
      "plugin.demo", "plugin.demo", permission, true
    ).status, 200);
  }
  const add = await call("00");
  assert.equal(add.status, 200, JSON.stringify(add));
  assert.equal(add.value.status, 201);
  const visible = core.listActionContracts("plugin.demo");
  const extension = visible.value.items.find(item =>
    item.id === "plugin.demo.run" && item.owner === "UICO.editor");
  assert.equal(extension?.described, true);
  assert.equal(extension?.executable, false);
  core.register({ id: "Observer", receive: async () => null });
  assert.equal(core.listActionContracts("Observer").value.items.some(item =>
    item.id === "plugin.demo.run" && item.owner === "UICO.editor"), false);
  assert.equal((await call("10")).value.entry.revision, 1);
  assert.equal((await call("11", { expectedRevision: 1 }))
    .value.entry.revision, 2);
  assert.equal((await call("01", { expectedRevision: 2 }))
    .value.status, 200);
  assert.equal((await call("10")).status, 404);
  assert.equal(core.revokePluginPermission(
    "plugin.demo", "plugin.demo", "ui.api.extension.add"
  ).status, 200);
  assert.equal((await call("00")).status, 403);
  assert.ok(core.omu.snapshot().dependencies.some(row =>
    row.link === "plugin.demo->UICO"));
});
