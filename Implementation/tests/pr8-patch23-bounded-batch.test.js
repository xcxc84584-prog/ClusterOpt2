import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { SliceRegistry } from "../object/SliceRegistry.js";
import { SliceLoader } from "../object/SliceLoader.js";
import { VirtualLineIndex } from "../object/VirtualLineIndex.js";
import { ViewportSliceController } from
  "../object/ViewportSliceController.js";

function fixture(blob, bytes = 1024) {
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
  return { call, core, open: () =>
    call("viewport-slices", "open", {
      id: "parallel", blob, chunkBytes: bytes
    }) };
}

test("PR8+23 bounded batch rejects overflow before reading", async () => {
  let reads = 0;
  class MonitoredBlob extends Blob {
    slice(start, end) {
      reads++;
      return super.slice(start, end);
    }
  }
  const { call, open } = fixture(
    new MonitoredBlob(["x".repeat(8192)]));
  assert.equal((await open()).status, 200);
  const invalid = await call("slice-loader", "loadBatch", {
    id: "parallel", indices: [0, 1, 2, 3, 4], mode: "preloaded"
  });
  assert.equal(invalid.status, 400);
  assert.equal(reads, 0);
  assert.equal((await call("slice-loader", "loadBatch", {
    id: "parallel", indices: [1, 1], mode: "preloaded"
  })).status, 400);
  assert.equal(reads, 0);
});

test("PR8+23 bounded parallel preloads honor registry budget", async () => {
  let inFlight = 0;
  let maximum = 0;
  class ConcurrentBlob extends Blob {
    slice(start, end) {
      const original = super.slice(start, end);
      return {
        async arrayBuffer() {
          inFlight++;
          maximum = Math.max(maximum, inFlight);
          await new Promise(resolve => setTimeout(resolve, 2));
          try {
            return await original.arrayBuffer();
          } finally {
            inFlight--;
          }
        }
      };
    }
  }
  const { call, open } = fixture(
    new ConcurrentBlob(["x".repeat(8192)]));
  assert.equal((await open()).status, 200);
  assert.equal((await call("slice-registry", "setLimit", {
    bytes: 1024
  })).status, 200);
  const batch = await call("slice-loader", "loadBatch", {
    id: "parallel", indices: [0, 1, 2], mode: "preloaded"
  });
  assert.equal(batch.status, 200);
  assert.ok(maximum >= 2);
  assert.equal(batch.value.loaded.length, 1);
  assert.equal(batch.value.skipped.length, 2);
  const snapshot = (await call("slice-registry", "list")).value;
  assert.ok(snapshot.entries.reduce((sum, item) =>
    sum + item.residentBytes, 0) <= 1024);
});

test("PR8+23 full batch fails closed on memory exhaustion", async () => {
  const { call, open } = fixture(new Blob(["x".repeat(8192)]));
  assert.equal((await open()).status, 200);
  assert.equal((await call("slice-registry", "setLimit", {
    bytes: 1024
  })).status, 200);
  const response = await call("slice-loader", "loadBatch", {
    id: "parallel", indices: [0, 1], mode: "full"
  });
  assert.equal(response.status, 413);
  const entries = (await call("slice-registry", "list")).value.entries;
  const resident = entries.filter(entry => entry.residentBytes > 0);
  assert.equal(resident.length, 1);
});
