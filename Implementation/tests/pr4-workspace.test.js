import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";

function createFixture() {
  const core = new LinkCore();
  let renders = 0;
  const workspace = new FileWorkspace(core, () => { renders++; });
  return { core, workspace, get renders() { return renders; } };
}

test("PR4 reorder preserves active document identity and unsaved content", () => {
  const { workspace } = createFixture();
  const a = workspace.create();
  const b = workspace.create();
  const c = workspace.create();
  workspace.documents[0].text = "unsaved A";
  workspace.activate(b);
  assert.equal(workspace.reorder(0, 2), true);
  assert.deepEqual(workspace.documents.map(doc => doc.id), [b, c, a]);
  assert.equal(workspace.activeId, b);
  assert.equal(workspace.documents[2].text, "unsaved A");
  assert.throws(() => workspace.reorder(-1, 0), RangeError);
  assert.throws(() => workspace.reorder(0, 10), RangeError);
});

test("PR4 Close All cancellation never discards dirty files", () => {
  const { workspace, core } = createFixture();
  const previousWindow = globalThis.window;
  let confirms = 0;
  globalThis.window = { confirm() { confirms++; return false; } };
  try {
    workspace.create();
    workspace.create();
    assert.equal(workspace.closeAll(), false);
    assert.equal(confirms, 1);
    assert.equal(workspace.documents.length, 2);
    assert.equal(core.getSnapshot().objects.filter(item =>
      item.startsWith("document-")).length, 2);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("PR4 Close All unregisters files only after confirmation", () => {
  const { workspace } = createFixture();
  const previousWindow = globalThis.window;
  globalThis.window = { confirm: () => true };
  try {
    workspace.create();
    workspace.create();
    assert.equal(workspace.closeAll(), true);
    assert.deepEqual(workspace.documents, []);
    assert.equal(workspace.activeId, null);
  } finally {
    globalThis.window = previousWindow;
  }
});
