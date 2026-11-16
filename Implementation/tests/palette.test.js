import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { UI_COLOR } from "../property/UI_COLOR.js";
import { InterfacePalette } from "../object/InterfacePalette.js";

function storage(initial = null) {
  const entries = new Map();
  if (initial !== null) entries.set(UI_COLOR.storageKey, initial);
  return {
    getItem: name => entries.get(name) ?? null,
    setItem: (name, value) => entries.set(name, value)
  };
}

function root() {
  const properties = new Map();
  return {
    properties,
    style: {
      setProperty: (name, value) => properties.set(name, value),
      colorScheme: "dark"
    }
  };
}

function create(storageValue = null) {
  const core = new LinkCore();
  core.register({ id: "ui", receive: async () => null });
  const host = root();
  const palette = new InterfacePalette(core, {
    storage: storage(storageValue), target: host
  });
  return { core, palette, host };
}

test("UI_COLOR accepts only integer RGB 0..255", () => {
  assert.equal(UI_COLOR.valid([0, 127, 255]), true);
  for (const bad of [
    [-1, 0, 0], [256, 0, 0], [1.5, 0, 0],
    [0, 0], "red", null, [NaN, 1, 2]
  ]) assert.equal(UI_COLOR.valid(bad), false);
  assert.equal(UI_COLOR.toHex([10, 22, 255]), "#0A16FF");
  assert.deepEqual(UI_COLOR.fromHex("#0A16FF"), [10, 22, 255]);
});

test("User set writes shared UI_COLOR via Hub and changes CSS tokens", async () => {
  const { core, palette, host } = create();
  const result = await core.request("ui", "InterfacePalette", "set",
    { rgb: [30, 70, 130] }, { origin: "user" });
  assert.equal(result.status, 200);
  assert.deepEqual(core.readProperty("ui", "UI_COLOR").value,
    [30, 70, 130]);
  assert.equal(host.properties.get("--ui-background"), "rgb(30, 70, 130)");
  assert.equal(palette.snapshot().hex, "#1E4682");
  assert.ok(core.getSnapshot().logs.some(item =>
    item.action === "Property.UI_COLOR" && item.status === 200));
});

test("Rejected RGB is EHU 400 and leaves property unchanged", async () => {
  const { core } = create();
  const result = await core.request("ui", "InterfacePalette", "set",
    { rgb: [300, 0, 0] }, { origin: "user" });
  assert.equal(result.status, 400);
  assert.deepEqual(core.readProperty("ui", "UI_COLOR").value, [0, 0, 0]);
  assert.ok(core.getSnapshot().logs.some(item =>
    item.kind === "EHU" && item.status === 400));
});

test("Agent cannot mutate palette, but can read it", async () => {
  const { core } = create();
  const denied = await core.request("ui", "InterfacePalette", "set",
    { rgb: [255, 255, 255] }, { origin: "agent" });
  assert.equal(denied.status, 403);
  const get = await core.request("ui", "InterfacePalette", "get",
    {}, { origin: "agent" });
  assert.equal(get.status, 200);
  assert.equal(get.value.hex, "#000000");
});

test("Restored preference is shared with all registered objects", () => {
  const { core, palette, host } = create("[255,245,235]");
  core.register({ id: "Panel", receive: async () => null });
  assert.deepEqual(core.readProperty("Panel", "UI_COLOR").value,
    [255, 245, 235]);
  assert.equal(palette.snapshot().mode, "light");
  assert.equal(host.style.colorScheme, "light");
  assert.equal(host.properties.get("--ui-text"), "rgb(0, 0, 0)");
});

test("Invalid stored RGB triggers EHU and falls back safely", () => {
  const { core, palette } = create("[999,1,1]");
  assert.equal(palette.snapshot().hex, "#000000");
  assert.ok(core.getSnapshot().logs.some(item =>
    item.kind === "EHU" && item.action === "Restore"));
});
