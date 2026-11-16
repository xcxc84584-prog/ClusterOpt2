import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { SliceRegistry } from "../object/SliceRegistry.js";
import { SliceLoader } from "../object/SliceLoader.js";
import { VirtualLineIndex } from "../object/VirtualLineIndex.js";
import { ViewportSliceController } from "../object/ViewportSliceController.js";
import { EditorViewportObserver } from "../object/EditorViewportObserver.js";
import { ViewportLinePolicy } from "../property/ViewportLinePolicy.js";

function setup() {
  const core = new LinkCore();
  new SliceRegistry(core);
  new SliceLoader(core);
  new VirtualLineIndex(core);
  new ViewportSliceController(core);
  new EditorViewportObserver(core);
  const request = (action, payload) => core.request("ui",
    "editor-viewport-observer", action, payload,
    { origin: "user" });
  return { core, request };
}

test("Patch14 clamps visible line range to actual line count", () => {
  assert.deepEqual(ViewportLinePolicy.range({
    scrollTop: 500, clientHeight: 200,
    lineHeight: 20, maxLine: 2
  }), { firstLine: 2, lastLine: 2 });
});

test("Patch14 observes a clean document through Hub, then detaches", async () => {
  const { request } = setup();
  const opened = await request("attach", {
    id: "document-14", blob: new Blob(["a\nb\nc\n"])
  });
  assert.equal(opened.ok, true, opened.error);
  const result = await request("navigate", {
    id: "document-14", scrollTop: 20,
    clientHeight: 80, lineHeight: 20,
    maxLine: 4, dirty: false
  });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.value.lines,
    { firstLine: 2, lastLine: 4 });
  assert.equal((await request("detach")).ok, true);
  const status = await request("describe");
  assert.equal(status.value.activeId, null);
});

test("Patch14 rejects dirty and stale document viewport requests", async () => {
  const { request } = setup();
  assert.equal((await request("attach", {
    id: "document-a", blob: new Blob(["hello"])
  })).ok, true);
  for (const payload of [
    { id: "document-a", dirty: true },
    { id: "document-old", dirty: false }
  ]) {
    const response = await request("navigate", {
      ...payload, scrollTop: 0, clientHeight: 40,
      lineHeight: 20, maxLine: 1
    });
    assert.equal(response.ok, false);
    assert.equal(response.status, 409);
  }
  assert.equal((await request("detach")).ok, true);
});
