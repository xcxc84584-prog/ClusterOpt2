import test from "node:test";
import assert from "node:assert/strict";
import { VirtualTestEnvironment } from "../LinkCore/VirtualTestEnvironment.js";
import { ToolTabManager } from "../object/ToolTabManager.js";
import { ToolTabPolicy } from "../property/ToolTabPolicy.js";

test("PR8 Patch10 tool tab EventChain and FIFO lifecycle", async () => {
  const vte = new VirtualTestEnvironment();
  assert.equal(vte.create("actor").status, 201);
  const tabs = new ToolTabManager(vte.core);
  const call = (action, payload = {}) =>
    vte.core.request("VTE.actor", tabs.id, action, payload);
  assert.equal((await call("list")).value.open, false);
  const opened = await call("open", { index: 2, documentCount: 2 });
  assert.equal(opened.status, 200);
  assert.equal(opened.value.active, true);
  const repeated = await call("open", { index: 0, documentCount: 2 });
  assert.equal(repeated.value.position, 2);
  const entries = ToolTabPolicy.entries([
    { id: "fileA", name: "A" }, { id: "fileB", name: "B" }
  ], repeated.value);
  assert.deepEqual(entries.map(x => x.id), [
    "fileA", "fileB", ToolTabPolicy.pluginId
  ]);
  assert.equal((await call("move", {
    index: 0, documentCount: 2
  })).value.position, 0);
  assert.equal((await call("deactivate")).value.active, false);
  assert.equal((await call("activate")).value.active, true);
  const restored = await call("restore", {
    documentCount: 1,
    state: { open: true, active: true, position: 2 }
  });
  assert.equal(restored.status, 200);
  assert.equal(restored.value.position, 1);
  assert.equal((await call("restore", {
    documentCount: 1,
    state: { open: false, active: true, position: 0 }
  })).status, 400);
  assert.equal((await call("close")).value.open, false);
  assert.equal((await call("activate")).status, 404);
  assert.equal((await call("move", {
    index: 8, documentCount: 2
  })).status, 404);
  assert.equal((await call("open", {
    index: 3, documentCount: 2
  })).status, 400);
  assert.equal((await call("mystery")).status, 400);
  const logs = vte.log();
  assert.ok(logs.some(x => x.kind === "EHU" &&
    x.source === "tool-tab-manager" && x.status === 400));
  assert.ok(logs.some(x => x.kind === "EHU" &&
    x.source === "tool-tab-manager" && x.status === 404));
  const deps = vte.snapshot().dependencies;
  assert.ok(deps.some(x => x.link === "VTE.actor->tool-tab-manager" &&
    x.code === "10"));
  assert.ok(deps.some(x => x.link === "tool-tab-manager->VTE.actor" &&
    x.code === "01"));
});

test("PR8 tool tab policy never mutates document identities", () => {
  const docs = [
    { id: "fileA", name: "A" }, { id: "fileB", name: "B" }
  ];
  const before = JSON.stringify(docs);
  const output = ToolTabPolicy.entries(docs, {
    open: true, active: true, position: 1
  });
  assert.equal(output[1].kind, "tool");
  assert.equal(JSON.stringify(docs), before);
  assert.equal(output.length, 3);
  assert.throws(() => ToolTabPolicy.validIndex(-1, 2), /Invalid/);
  assert.throws(() => ToolTabPolicy.validIndex(3, 2), /Invalid/);
});
