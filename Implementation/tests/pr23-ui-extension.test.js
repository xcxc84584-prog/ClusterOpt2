import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { UIExtensionAPIPolicy as policy } from
  "../property/UIExtensionAPIPolicy.js";

const descriptor = (owner = "plugin.demo") => ({
  apiVersion: 1,
  id: "plugin.demo.run",
  owner,
  action: "run",
  version: "1.0.0",
  visibility: "Public",
  sideEffect: "read",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" }
});
const request = (code, extra = {}) => ({
  uiId: "editor", apiId: "plugin.demo.run",
  operationCode: code, descriptor: descriptor(),
  ...extra
});
const actor = (ownerId = "plugin.demo") => ({
  ownerId, authorized: true
});

test("PR23.4 add/query/update/delete round-trip with revisions", () => {
  const empty = new Map();
  const add = policy.transition(empty, request("00"), actor());
  assert.equal(add.status, 201);
  assert.equal(empty.size, 0);
  assert.equal(add.value.entry.revision, 1);
  const query = policy.transition(add.value.state,
    request("10"), actor());
  assert.equal(query.status, 200);
  const update = policy.transition(add.value.state,
    request("11", { expectedRevision: 1 }), actor());
  assert.equal(update.status, 200);
  assert.equal(update.value.entry.revision, 2);
  const del = policy.transition(update.value.state,
    request("01", { expectedRevision: 2 }), actor());
  assert.equal(del.status, 200);
  assert.equal(del.value.state.size, 0);
});

test("PR23.4 native delete and cross-owner mutation deny", () => {
  const native = new Map([["editor/native.save", Object.freeze({
    provenance: "native", ownerId: "LinkCore", revision: 1
  })]]);
  assert.equal(policy.transition(native, request("01", {
    apiId: "native.save", expectedRevision: 1
  }), actor()).status, 403);
  const add = policy.transition(new Map(), request("00"), actor());
  for (const operationCode of ["01", "10", "11"]) {
    assert.equal(policy.transition(add.value.state,
      request(operationCode, { expectedRevision: 1 }),
      actor("plugin.other")).status, 403);
  }
  assert.equal(add.value.state.size, 1);
});

test("PR23.4 duplicate, stale, forbidden owner and bad inputs deny", () => {
  const add = policy.transition(new Map(), request("00"), actor());
  const state = add.value.state;
  assert.equal(policy.transition(state, request("00"), actor()).status, 409);
  assert.equal(policy.transition(state,
    request("11", { expectedRevision: 0 }), actor()).status, 409);
  assert.equal(policy.transition(new Map(),
    request("00"), actor("plugin.other")).status, 400);
  assert.equal(policy.transition(new Map(),
    request("00"), { ...actor(), authorized: false }).status, 403);
  assert.equal(policy.transition(state,
    request("42"), actor()).status, 400);
});

test("PR23.6 host UISP surfaces are URU registered and read-only", async () => {
  const core = new LinkCore();
  const ui = {
    uiId: "editor", kind: "panel", parentId: "root",
    owner: "LinkCore", revision: 0,
    geometry: { space: "viewport", x: 0, y: 0,
      width: 600, height: 400 },
    appearance: {}, interaction: {}, accessibility: {}
  };
  assert.equal(core.uiControl.registerHostSurface(ui).status, 201);
  assert.equal(core.uiControl.registerHostSurface(ui).status, 409);
  assert.ok(core.uru.objects.has("UICO.editor"));
  core.register({ id: "Reader", receive: async () => null });
  const response = await core.request("Reader", "UICO.editor",
    "getState", {}, { origin: "user" });
  assert.equal(response.status, 200);
  assert.equal(response.value.uiId, "editor");
  assert.equal(Object.isFrozen(response.value), true);
  const denied = await core.request("Reader", "UICO.editor",
    "update", { x: 20 }, { origin: "user" });
  assert.equal(denied.status, 403);
  assert.ok(core.omu.snapshot().logs.some(entry =>
    entry.kind === "EHU" && entry.status === 403));
});

test("PR23.5 authorized API List includes full UICO and UI Object schemas", () => {
  const core = new LinkCore();
  core.register({ id: "Reader", receive: async () => null });
  const before = core.listActionContracts("Reader");
  assert.equal(before.ok, true);
  for (const action of ["describe", "list", "extensionAPI",
                       "uiRequest"]) {
    const entry = before.value.items.find(item =>
      item.owner === "UICO" && item.action === action);
    assert.equal(entry?.described, true, action);
    assert.equal(entry?.inputSchema.type, "object");
    assert.equal(entry?.outputSchema.type,
      action === "list" ? "array" : "object");
  }
  const surface = {
    uiId: "editor", kind: "panel", parentId: "root",
    owner: "LinkCore", revision: 0,
    geometry: { space: "viewport", x: 0, y: 0,
      width: 500, height: 300 },
    appearance: {}, interaction: {}, accessibility: {}
  };
  assert.equal(core.uiControl.registerHostSurface(surface).status, 201);
  const after = core.listActionContracts("Reader");
  const entries = after.value.items.filter(item =>
    item.owner === "UICO.editor");
  assert.deepEqual(entries.map(item => item.action),
    ["describe", "getState"]);
  assert.ok(entries.every(item => item.described &&
    item.inputSchema && item.outputSchema));
  assert.equal(core.listActionContracts("unknown").status, 404);
});

test("PR23.5 API List exposes typed UICO envelopes and capabilities", () => {
  const core = new LinkCore();
  core.register({ id: "Reader", receive: async () => null });
  const contracts = core.listActionContracts("Reader");
  assert.equal(contracts.status, 200);
  const find = name => contracts.value.items.find(item =>
    item.owner === "UICO" && item.action === name);
  const request = find("uiRequest");
  assert.equal(request?.described, true);
  assert.deepEqual(request.inputSchema.required,
    ["protocol", "requestId", "targetId", "action", "payload"]);
  assert.deepEqual(request.outputSchema.required,
    ["requestId", "eventId", "status", "ok"]);
  assert.equal(request.inputSchema.additionalProperties, false);
  assert.ok(request.permissions.includes("ui.create.own"));
  assert.ok(request.permissions.includes("ui.window"));
  assert.ok(request.permissions.includes("ui.read"));
  const extension = find("extensionAPI");
  assert.deepEqual(extension.inputSchema.required,
    ["providerId", "uiId", "apiId", "operationCode"]);
  assert.equal(extension.permissions.length, 4);
  assert.ok(extension.permissions.includes("ui.api.extension.delete"));
  assert.equal(find("list").outputSchema.type, "array");
});
