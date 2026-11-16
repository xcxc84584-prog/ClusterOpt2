import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { SliceRegistry } from "../object/SliceRegistry.js";
import { SliceLoader } from "../object/SliceLoader.js";
import { VirtualLineIndex } from "../object/VirtualLineIndex.js";
import { ViewportSliceController } from
  "../object/ViewportSliceController.js";

test("PR8+23 two document viewports do not clear one another", async () => {
  const core = new LinkCore();
  new SliceRegistry(core, null);
  new SliceLoader(core);
  new VirtualLineIndex(core);
  new ViewportSliceController(core);
  core.register({
    id: "actor", authorization: { default: "Public" },
    receive: async () => null
  });
  const call = (target, action, payload = {}) =>
    core.request("actor", target, action, payload);
  for (const id of ["docA", "docB"]) {
    assert.equal((await call("viewport-slices", "open", {
      id, blob: new Blob(["a".repeat(8192)]),
      chunkBytes: 1024
    })).status, 200);
    assert.equal((await call("viewport-slices", "navigate", {
      id, first: 0, last: 0, adjacent: 0
    })).status, 200);
  }
  const registry = core.uru.get?.("slice-registry") ??
    core.uru.objects?.get?.("slice-registry");
  // Read the public admission contract rather than implementation maps:
  // both full slices must be protected from eviction at 1 KiB.
  assert.equal((await call("slice-registry", "setLimit", {
    bytes: 1024
  })).status, 413);
  const state = (await call("slice-registry", "list")).value.entries;
  for (const id of ["docA", "docB"]) {
    assert.equal(state.find(entry =>
      entry.id === id + "-slice-0").state, "full");
  }
  const closed = await call("viewport-slices", "close", { id: "docA" });
  assert.equal(closed.status, 200);
  assert.equal((await call("slice-registry", "setLimit", {
    bytes: 1024
  })).status, 200);
  const after = (await call("slice-registry", "list")).value.entries;
  assert.equal(after.find(entry =>
    entry.id === "docB-slice-0").state, "full");
  assert.ok(core.getSnapshot().dependencies.some(item =>
    item.link === "viewport-slices->slice-registry"));
});
