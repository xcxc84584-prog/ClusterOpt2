import test from "node:test";
import assert from "node:assert/strict";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";
import { SliceLoader } from "../object/SliceLoader.js";
import { SliceRegistry } from "../object/SliceRegistry.js";
import { ViewportSliceController } from
  "../object/ViewportSliceController.js";

function fixture() {
  const vte = new VirtualTestEnvironment();
  vte.create("actor");
  new SliceRegistry(vte.core, null);
  new SliceLoader(vte.core);
  new ViewportSliceController(vte.core);
  const request = (target, action, payload = {}) =>
    vte.core.request("VTE.actor", target, action, payload);
  return { vte, request };
}

test("PR8 viewport VTE loads full visible and preloads adjacent", async () => {
  const { vte, request } = fixture();
  let reads = 0;
  class TrackedBlob extends Blob {
    slice(start, end) {
      reads++;
      return super.slice(start, end);
    }
  }
  const blob = new TrackedBlob(["x".repeat(5 * 1024)]);
  const opened = await request("viewport-slices", "open", {
    id: "doc", blob, chunkBytes: 1024
  });
  assert.equal(opened.status, 200);
  assert.equal(reads, 0);
  const result = await request("viewport-slices", "navigate", {
    id: "doc", first: 1, last: 1, adjacent: 1
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.value.full, [1]);
  assert.deepEqual(result.value.preloaded, [0, 2]);
  assert.ok(reads > 0);
  assert.equal((await request("slice-registry", "read", {
    id: "doc-slice-1"
  })).status, 200);
  assert.equal((await request("slice-registry", "read", {
    id: "doc-slice-0"
  })).status, 409);
  assert.equal((await request("slice-registry", "markDirty", {
    id: "doc-slice-1"
  })).status, 200);
  const move = await request("viewport-slices", "navigate", {
    id: "doc", first: 3, last: 3, adjacent: 1
  });
  assert.equal(move.status, 200);
  const list = (await request("slice-registry", "list")).value.entries;
  const dirty = list.find(item => item.id === "doc-slice-1");
  assert.equal(dirty.dirty, true);
  assert.equal(dirty.state, "full");
  assert.equal(list.find(item => item.id === "doc-slice-0").state,
    "virtual");
  const back = await request("viewport-slices", "navigate", {
    id: "doc", first: 1, last: 1, adjacent: 0
  });
  assert.equal(back.status, 200);
  assert.equal((await request("slice-registry", "list")).value.entries
    .find(item => item.id === "doc-slice-1").dirty, true);
  const bad = await request("viewport-slices", "navigate", {
    id: "doc", first: 0, last: 20
  });
  assert.equal(bad.status, 400);
  assert.equal((await request("viewport-slices", "describe", {
    id: "missing"
  })).status, 404);
  assert.ok(vte.log().some(item => item.kind === "EHU" &&
    item.status === 400));
  const deps = vte.snapshot().dependencies;
  assert.ok(deps.some(item =>
    item.link === "VTE.actor->viewport-slices" &&
    item.code === "10"));
  assert.ok(deps.some(item =>
    item.link === "viewport-slices->VTE.actor" &&
    item.code === "01"));
  assert.ok(deps.some(item =>
    item.link === "viewport-slices->slice-loader" &&
    item.code === "10"));
});

test("PR8 viewport policy rejects unbounded visible ranges", async () => {
  const { request } = fixture();
  await request("viewport-slices", "open", {
    id: "large", blob: new Blob(["x".repeat(40 * 1024)]),
    chunkBytes: 1024
  });
  const exceeded = await request("viewport-slices", "navigate", {
    id: "large", first: 0, last: 16
  });
  assert.equal(exceeded.status, 400);
});
