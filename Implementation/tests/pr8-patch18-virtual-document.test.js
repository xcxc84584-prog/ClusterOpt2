import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { VirtualFileDocument } from "../object/VirtualFileDocument.js";
import { SliceEditTransaction } from "../object/SliceEditTransaction.js";
import { SliceRecoveryJournal } from "../object/SliceRecoveryJournal.js";
import { SliceWritebackUnit } from "../object/SliceWritebackUnit.js";
import { SliceBatchWritebackUnit } from "../object/SliceBatchWritebackUnit.js";

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
  const checkpoints = new Map();
  new SliceRecoveryJournal(core, {
    async get(id) { return structuredClone(checkpoints.get(id)); },
    async putIfNewer(entry) {
      const current = checkpoints.get(entry.id);
      if (current && current.revision >= entry.revision) {
        const error = new Error("Stale checkpoint");
        error.status = 409;
        throw error;
      }
      checkpoints.set(entry.id, structuredClone(entry));
    },
    async deleteIfMatch(id, revision, checksum) {
      const current = checkpoints.get(id);
      if (!current || current.revision !== revision ||
          current.checksum !== checksum) {
        const error = new Error("Checkpoint changed");
        error.status = 409;
        throw error;
      }
      checkpoints.delete(id);
    }
  });
  new SliceEditTransaction(core);
  new SliceWritebackUnit(core);
  new SliceBatchWritebackUnit(core);
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

test("Patch19 large page edits cannot bypass verified writeback",
  async () => {
    const { workspace, request } = setup();
    const handle = fakeHandle();
    assert.equal((await request("workspace", "open", {
      handles: [handle]
    })).ok, true);
    const doc = workspace.active;
    const edited = await request(doc.id, "edit", {
      text: "replaced bounded page"
    });
    assert.equal(edited.ok, true, edited.error);
    assert.equal(doc.status, "yellow");
    assert.equal((await request("workspace", "page", {
      id: doc.id, index: 1
    })).ok, true);
    // Mock handle has no authorized createWritable method:
    // a partial page may never silently become a full-file save.
    assert.equal((await request(doc.id, "save")).status, 400);
    assert.equal(doc.status, "yellow");
    assert.equal(doc.dirtyPages.get(0).text,
      "replaced bounded page");
    const state = await request(doc.id, "describePage");
    assert.equal(state.ok, true, state.error);
    assert.equal(state.value.textLength, doc.text.length);
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
    assert.equal(snapshot.documents[0].text, "");
    assert.ok(doc.text.length <= 65540);
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

test("Patch18 Hub records page EventChain and directed dependencies",
  async () => {
    const { core, workspace, request } = setup();
    const handle = fakeHandle();
    assert.equal((await request("workspace", "open", {
      handles: [handle]
    })).ok, true);
    const doc = workspace.active;
    assert.equal((await request("workspace", "page", {
      id: doc.id, index: 1
    })).ok, true);
    assert.equal((await request("workspace", "page", {
      id: doc.id, index: -1
    })).status, 400);
    const snapshot = core.getSnapshot();
    assert.ok(snapshot.dependencies.some(item =>
      item.link === "workspace->" + doc.id && item.code === "10"));
    assert.ok(snapshot.dependencies.some(item =>
      item.link === doc.id + "->workspace" && item.code === "01"));
    assert.ok(snapshot.logs.some(item =>
      item.kind === "EHU" && item.status === 400));
  });

test("Patch18 legacy file save guard blocks oversized source", async () => {
  const { FileDocument } = await import("../object/FileDocument.js");
  const handle = fakeHandle();
  let openedWriter = false;
  handle.createWritable = async () => {
    openedWriter = true;
    throw new Error("Writer should never open");
  };
  const doc = new FileDocument("unsafe.txt", handle);
  doc.text = "partial";
  await assert.rejects(() => doc.save(), error =>
    error.status === 409);
  assert.equal(openedWriter, false);
});
