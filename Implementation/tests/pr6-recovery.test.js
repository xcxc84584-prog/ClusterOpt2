import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { RecoveryPolicy } from "../property/RecoveryPolicy.js";

test("PR6 session snapshot restores text and viewing scroll", () => {
  const sourceCore = new LinkCore();
  const source = new FileWorkspace(sourceCore, () => {});
  source.create();
  source.active.text = "first\\nsecond";
  source.active.scrollTop = 420;
  source.active.cursor = 3;
  const snapshot = source.snapshot();
  const payload = { schema: 1, activeId: snapshot.activeId,
    documents: snapshot.documents, roots: [] };
  assert.equal(RecoveryPolicy.isSnapshot(payload), true);
  const restoredCore = new LinkCore();
  const restored = new FileWorkspace(restoredCore, () => {});
  assert.equal(restored.restoreSnapshot(payload), true);
  assert.equal(restored.active.text, "first\\nsecond");
  assert.equal(restored.active.scrollTop, 420);
  assert.equal(restored.active.cursor, 3);
  assert.equal(restored.documents.length, 1);
  assert.throws(() => restored.restoreSnapshot(payload));
});

test("PR6 rejects invalid and oversized recovery snapshots", () => {
  assert.equal(RecoveryPolicy.isSnapshot({
    schema: 999, documents: [], roots: []
  }), false);
  assert.equal(RecoveryPolicy.isDocument({
    name: "a", text: "abc", cursor: -1, scrollTop: 0
  }), false);
});
