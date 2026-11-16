import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { SliceRegistry } from "../object/SliceRegistry.js";

test("PR8 SliceRegistry limit persists Off without storing text", async () => {
  const state = new Map();
  const storage = {
    getItem(key) { return state.get(key) ?? null; },
    setItem(key, value) { state.set(key, value); }
  };
  const first = new LinkCore();
  new SliceRegistry(first, storage);
  first.register({ id: "tester", receive: async () => null });
  const update = await first.request("tester", "slice-registry",
    "setLimit", { bytes: null });
  assert.equal(update.ok, true);
  assert.equal(state.get("clusteropt2.slice.limit.v1"), "null");
  const second = new LinkCore();
  new SliceRegistry(second, storage);
  second.register({ id: "tester", receive: async () => null });
  const restored = await second.request("tester", "slice-registry", "list");
  assert.equal(restored.value.limitBytes, null);
});
