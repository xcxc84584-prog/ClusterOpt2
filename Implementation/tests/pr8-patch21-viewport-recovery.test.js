import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { RecoveryPolicy } from "../property/RecoveryPolicy.js";

test("PR8+21 recovery stores physical viewport independently of caret", () => {
  const core = new LinkCore();
  const workspace = new FileWorkspace(core, () => {});
  workspace.create();
  workspace.active.text = "A\\nB\\nC";
  workspace.active.cursor = 1;
  workspace.active.scrollTop = 147.5;
  workspace.active.scrollLeft = 39.25;
  workspace.active.viewportLineHeight = 24;
  const snapshot = workspace.snapshot();
  assert.equal(snapshot.documents[0].scrollTop, 147.5);
  assert.equal(snapshot.documents[0].scrollLeft, 39.25);
  assert.equal(snapshot.documents[0].cursor, 1);
  assert.equal(snapshot.documents[0].viewportLineHeight, 24);
  assert.equal(RecoveryPolicy.isSnapshot({
    schema: RecoveryPolicy.schema,
    ...snapshot, roots: []
  }), true);

  const restoredCore = new LinkCore();
  const restored = new FileWorkspace(restoredCore, () => {});
  restored.restoreSnapshot(snapshot);
  assert.equal(restored.active.scrollTop, 147.5);
  assert.equal(restored.active.scrollLeft, 39.25);
  assert.equal(restored.active.viewportLineHeight, 24);
  assert.equal(restored.active.cursor, 1);
});

test("PR8+21 invalid horizontal position rejects snapshot", () => {
  const snapshot = {
    schema: RecoveryPolicy.schema, roots: [],
    documents: [{
      name: "file.md", text: "a", cursor: 0, scrollTop: 0,
      scrollLeft: -1
    }]
  };
  assert.equal(RecoveryPolicy.isSnapshot(snapshot), false);
  delete snapshot.documents[0].scrollLeft;
  assert.equal(RecoveryPolicy.isSnapshot(snapshot), true);
});
