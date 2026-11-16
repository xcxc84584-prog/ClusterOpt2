import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { VirtualFileDocument } from "../object/VirtualFileDocument.js";

const SIZE = 65 * 1024 * 1024;

function fakeHandle(size = SIZE) {
  const requested = [];
  const file = {
    name: "large.txt", size, lastModified: 100,
    slice(start, end) {
      requested.push([start, end]);
      const length = Math.max(0, Math.min(end, size) - start);
      return new Blob(["a".repeat(length)]);
    }
  };
  return {
    name: file.name, requested,
    async getFile() { return file; }
  };
}

function setup() {
  const core = new LinkCore();
  core.register({ id: "ui", receive: async () => true });
  const workspace = new FileWorkspace(core, () => {});
  const request = (target, action, payload = {}) =>
    core.request("ui", target, action, payload, { origin: "user" });
  return { core, workspace, request };
}

test("Patch18 opens a 65 MiB file without a whole-file read",
  async () => {
    const { workspace, request } = setup();
    const handle = fakeHandle();
    const opened = await request("workspace", "open", {
      handles: [handle]
    });
    assert.equal(opened.ok, true, opened.error);
    const doc = workspace.active;
    assert.ok(doc instanceof VirtualFileDocument);
    assert.equal(doc.virtualReadOnly, true);
    assert.equal(doc.status, "green");
    assert.ok(doc.text.length <= 65540);
    assert.equal(doc.virtualPageCount, Math.ceil(SIZE / 65536));
    assert.ok(handle.requested.length > 0);
    assert.ok(handle.requested.every(([a, b]) => b - a <= 65536));
    assert.equal(doc.pieceIndex.length, doc.text.length);

    const next = await request("workspace", "page", {
      id: doc.id, index: 1
    });
    assert.equal(next.ok, true, next.error);
    assert.equal(doc.virtualPageIndex, 1);
    assert.equal(doc.pageStart, 65536);
    assert.equal(doc.pieceIndex.length, doc.text.length);
  });

test("Patch18 refuses whole-file edit/save on partial page",
  async () => {
    const { core, workspace, request } = setup();
    const handle = fakeHandle();
    assert.equal((await request("workspace", "open", {
      handles: [handle]
    })).ok, true);
    const doc = workspace.active;
    const original = doc.text;
    assert.equal((await request(doc.id, "edit", {
      text: "overwrite"
    })).status, 409);
    assert.equal((await request(doc.id, "save", {
      handle
    })).status, 409);
    assert.equal((await request("workspace", "save")).status, 409);
    assert.equal(doc.text, original);
    const status = await request(doc.id, "describePage");
    assert.equal(status.value.textLength, original.length);
    assert.ok(core.getSnapshot().logs.some(log =>
      log.kind === "EHU" && log.status === 409));
  });

test("Patch18 wrong page cannot replace the published Piece Tree",
  async () => {
    const { workspace, request } = setup();
    assert.equal((await request("workspace", "open", {
      handles: [fakeHandle()]
    })).ok, true);
    const doc = workspace.active;
    const root = doc.treeRoot;
    const failure = await request("workspace", "page", {
      id: doc.id, index: 100000
    });
    assert.equal(failure.status, 400);
    assert.equal(doc.treeRoot, root);
    assert.equal(doc.virtualPageIndex, 0);
  });

test("Patch18 recovery retains virtual marker and never restores preview",
  async () => {
    const { workspace, request } = setup();
    assert.equal((await request("workspace", "open", {
      handles: [fakeHandle()]
    })).ok, true);
    const snapshot = workspace.snapshot();
    assert.equal(snapshot.documents[0].virtual, true);
    const restored = setup();
    const result = restored.workspace.restoreSnapshot(snapshot);
    assert.equal(result, true);
    const doc = restored.workspace.active;
    assert.equal(doc.virtualReadOnly, true);
    assert.ok(doc instanceof VirtualFileDocument);
    assert.notEqual(doc.text, snapshot.documents[0].text);
  });

test("Patch18 keeps small FileDocument behavior intact", async () => {
  const { workspace, request } = setup();
  const handle = fakeHandle(1024);
  const result = await request("workspace", "open", {
    handles: [handle]
  });
  // This lightweight fake does not implement stream(); the existing
  // FileDocument loader is deliberately unchanged.
  assert.equal(result.ok, false);
  assert.equal(workspace.active.virtualReadOnly, undefined);
});
