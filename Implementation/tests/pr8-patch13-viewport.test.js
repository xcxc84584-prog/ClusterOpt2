import test from "node:test";
import assert from "node:assert/strict";
import { ViewportLinePolicy } from "../property/ViewportLinePolicy.js";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { SliceRegistry } from "../object/SliceRegistry.js";
import { SliceLoader } from "../object/SliceLoader.js";
import { VirtualLineIndex } from "../object/VirtualLineIndex.js";
import { ViewportSliceController } from "../object/ViewportSliceController.js";

test("PR8 Patch13 maps real pixel geometry to exact line addresses", () => {
  assert.deepEqual(ViewportLinePolicy.range({
    scrollTop: 40, clientHeight: 60, lineHeight: 20
  }), { firstLine: 3, lastLine: 5 });
  assert.deepEqual(ViewportLinePolicy.range({
    scrollTop: 80, clientHeight: 120, lineHeight: 40
  }), { firstLine: 3, lastLine: 5 });
  assert.deepEqual(ViewportLinePolicy.range({
    scrollTop: 5, clientHeight: 20, lineHeight: 10
  }), { firstLine: 1, lastLine: 3 });
});

test("PR8 Patch13 rejects invalid or unbounded geometry", () => {
  for (const geometry of [
    { scrollTop: -1, clientHeight: 100, lineHeight: 20 },
    { scrollTop: 0, clientHeight: 0, lineHeight: 20 },
    { scrollTop: 0, clientHeight: 100, lineHeight: 0 },
    { scrollTop: Infinity, clientHeight: 100, lineHeight: 20 },
    { scrollTop: 0, clientHeight: 1000000, lineHeight: 1 }
  ]) {
    assert.throws(() => ViewportLinePolicy.range(geometry),
      error => error.status === 400);
  }
});

test("PR8 Patch13 routes geometry through indexed slices and Hub", async () => {
  const core = new LinkCore();
  new SliceRegistry(core);
  new SliceLoader(core);
  new VirtualLineIndex(core);
  new ViewportSliceController(core);

  const opened = await core.request("ui", "viewport-slices", "open", {
    id: "patch13", blob: new Blob(["one\ntwo\nthree\nfour\nfive\n"])
  }, { origin: "user" });
  assert.equal(opened.ok, true, opened.error);

  const navigated = await core.request("ui", "viewport-slices",
    "navigateViewport", {
      id: "patch13", scrollTop: 20, clientHeight: 40,
      lineHeight: 20, adjacent: 0
    }, { origin: "user" });
  assert.equal(navigated.ok, true, navigated.error);
  assert.deepEqual(navigated.value.lines,
    { firstLine: 2, lastLine: 3 });
  assert.ok(navigated.value.full.length > 0);

  const closed = await core.request("ui", "viewport-slices", "close", {
    id: "patch13"
  }, { origin: "user" });
  assert.equal(closed.ok, true, closed.error);
});
