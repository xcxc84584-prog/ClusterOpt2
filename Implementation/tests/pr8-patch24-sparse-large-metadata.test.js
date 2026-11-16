import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { SliceRegistry } from "../object/SliceRegistry.js";
import { SliceLoader } from "../object/SliceLoader.js";
import { VirtualLineIndex } from "../object/VirtualLineIndex.js";
import { ViewportSliceController } from
  "../object/ViewportSliceController.js";

/**
 * Metadata-only fake large Blob: validates virtual registration does
 * not read file bodies. This is not real 1/5 GiB I/O stress testing.
 */
class SparseBlob extends Blob {
  constructor(size) {
    super([]);
    this.virtualSize = size;
    this.reads = 0;
  }
  get size() { return this.virtualSize; }
  slice(start, end) {
    this.reads++;
    throw new Error("Unexpected eager read " + start + ":" + end);
  }
}

test("PR8+24 virtual 1GiB/5GiB opens retain only metadata", async () => {
  const core = new LinkCore();
  new SliceRegistry(core, null);
  new SliceLoader(core);
  new VirtualLineIndex(core);
  new ViewportSliceController(core);
  core.register({
    id: "tester", authorization: { default: "Public" },
    receive: async () => null
  });
  for (const gib of [1, 5]) {
    const blob = new SparseBlob(gib * 1024 ** 3);
    const id = "large" + gib;
    const open = await core.request("tester", "viewport-slices",
      "open", { id, blob });
    assert.equal(open.status, 200);
    assert.equal(open.value.byteLength, gib * 1024 ** 3);
    assert.equal(blob.reads, 0);
    const close = await core.request("tester", "viewport-slices",
      "close", { id });
    assert.equal(close.status, 200);
  }
  const entries = (await core.request("tester", "slice-registry",
    "list")).value.entries;
  assert.equal(entries.length, 0);
});
