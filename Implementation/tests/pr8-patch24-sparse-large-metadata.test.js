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

/**
 * A virtual 5 GiB ASCII Blob backed by only the requested byte slice.
 * This measures random byte navigation and cache residency, not disk I/O.
 */
class SparseTextBlob extends Blob {
  constructor(size) {
    super([]);
    this.virtualSize = size;
    this.bytesRead = 0;
    this.maxRead = 0;
  }
  get size() { return this.virtualSize; }
  slice(start, end) {
    const bytes = end - start;
    if (bytes < 0 || bytes > 1024 * 1024) {
      throw new RangeError("Unbounded virtual file read");
    }
    this.bytesRead += bytes;
    this.maxRead = Math.max(bytes, this.maxRead);
    return new Blob(["x".repeat(bytes)]);
  }
}

test("PR8+24 5GiB random byte jump reads only bounded slices",
  async () => {
    const core = new LinkCore();
    new SliceRegistry(core, null);
    new SliceLoader(core);
    new VirtualLineIndex(core);
    new ViewportSliceController(core);
    core.register({
      id: "tester", authorization: { default: "Public" },
      receive: async () => null
    });
    const blob = new SparseTextBlob(5 * 1024 ** 3);
    const call = (target, action, payload = {}) =>
      core.request("tester", target, action, payload);
    const opened = await call("viewport-slices", "open", {
      id: "sparse5", blob, chunkBytes: 64 * 1024
    });
    assert.equal(opened.status, 200);
    const middle = opened.value.count - 2;
    const moved = await call("viewport-slices", "navigate", {
      id: "sparse5", first: middle, last: middle, adjacent: 1
    });
    assert.equal(moved.status, 200);
    assert.deepEqual(moved.value.full, [middle]);
    assert.deepEqual(moved.value.preloaded, [
      middle - 1, middle + 1
    ]);
    assert.ok(blob.maxRead <= 64 * 1024);
    assert.ok(blob.bytesRead < 256 * 1024);
    const registry = (await call("slice-registry", "list")).value;
    assert.ok(registry.entries.reduce((sum, entry) =>
      sum + entry.residentBytes, 0) <= 3 * 64 * 1024);
    await call("viewport-slices", "close", { id: "sparse5" });
    assert.equal((await call("slice-registry", "list")).value
      .entries.length, 0);
  });
