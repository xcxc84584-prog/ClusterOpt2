import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { VirtualFileDocument } from "../object/VirtualFileDocument.js";
import { SliceRecoveryJournal } from "../object/SliceRecoveryJournal.js";
import { SliceEditTransaction } from "../object/SliceEditTransaction.js";
import { SliceWritebackUnit } from "../object/SliceWritebackUnit.js";

function storage() {
  const entries = new Map();
  return {
    entries, fail: false,
    async get(id) { return structuredClone(entries.get(id)); },
    async putIfNewer(entry) {
      if (this.fail) {
        const error = new Error("Simulated quota failure");
        error.status = 503;
        throw error;
      }
      const previous = entries.get(entry.id);
      if (previous && previous.revision >= entry.revision) {
        const error = new Error("Stale checkpoint");
        error.status = 409;
        throw error;
      }
      entries.set(entry.id, structuredClone(entry));
    },
    async deleteIfMatch(id, revision, checksum) {
      const current = entries.get(id);
      if (!current || current.revision !== revision ||
          current.checksum !== checksum) {
        const error = new Error("Wrong checkpoint");
        error.status = 409;
        throw error;
      }
      entries.delete(id);
    }
  };
}

function handleOf(source) {
  let bytes = new TextEncoder().encode(source);
  let timestamp = 10;
  return {
    name: "virtual.txt",
    async getFile() {
      const file = new Blob([bytes]);
      Object.defineProperty(file, "lastModified", {
        value: timestamp
      });
      return file;
    },
    async createWritable() {
      const chunks = [];
      return {
        async write(chunk) {
          chunks.push(new Uint8Array(chunk));
        },
        async close() {
          bytes = Uint8Array.from(chunks.flatMap(chunk => [...chunk]));
          timestamp++;
        },
        async abort() {}
      };
    }
  };
}

function harness(handle, store = storage()) {
  const core = new LinkCore();
  core.register({ id: "ui", receive: async () => true });
  core.register({ id: "workspace", receive: async () => true });
  new SliceRecoveryJournal(core, store);
  new SliceWritebackUnit(core);
  new SliceEditTransaction(core);
  const doc = new VirtualFileDocument(handle.name, handle, core);
  assert.ok(core.register(doc));
  const call = (action, payload = {}) => core.request(
    "ui", doc.id, action, payload, { origin: "user" });
  const internal = (action, payload = {}) => core.request(
    "workspace", doc.id, action, payload);
  return { core, doc, store, call, internal };
}

test("Patch19 global numbers continue over physical byte pages",
  async () => {
    const source = "a\n".repeat(32768) + "b\nnext";
    const { doc, call, internal } = harness(handleOf(source));
    assert.equal((await internal("load")).ok, true);
    assert.equal(doc.pageFirstLine, 1);
    assert.equal((await call("page", { index: 1 })).ok, true);
    assert.equal(doc.pageFirstLine, 32769);
    assert.equal(doc.text, "b\nnext");
    assert.equal(doc.pieceIndex.length, doc.text.length);
  });

test("Patch19 durable edit, dirty-page block and verified save",
  async () => {
    const handle = handleOf("第一行\n第二行\n");
    const { doc, store, call, internal, core } = harness(handle);
    assert.equal((await internal("load")).ok, true);
    const edited = await call("edit", {
      text: "第一行\n修改第二行！\n"
    });
    assert.equal(edited.ok, true, edited.error);
    assert.equal(doc.status, "yellow");
    assert.equal(doc.editRevision, 1);
    assert.ok(store.entries.has(doc.editSliceId));
    assert.equal((await call("page", { index: 0 })).status, 409);
    const saved = await call("save");
    assert.equal(saved.ok, true, saved.error);
    assert.equal(doc.status, "green");
    assert.equal(await (await handle.getFile()).text(),
      "第一行\n修改第二行！\n");
    assert.equal(store.entries.size, 0);
    assert.ok(core.getSnapshot().dependencies.some(item =>
      item.link === doc.id + "->slice-edit-transaction" &&
      item.code === "10"));
  });

test("Patch19 durable store failure preserves prior page and EHU",
  async () => {
    const { doc, store, call, internal, core } = harness(
      handleOf("hello"));
    assert.equal((await internal("load")).ok, true);
    store.fail = true;
    const response = await call("edit", { text: "hello world" });
    assert.equal(response.status, 503);
    assert.equal(doc.text, "hello");
    assert.equal(doc.status, "green");
    assert.equal(doc.editRevision, 0);
    assert.ok(core.getSnapshot().logs.some(log =>
      log.kind === "EHU" && log.status === 503));
  });

test("Patch19 reload restores durable text with source fingerprint",
  async () => {
    const handle = handleOf("old");
    const store = storage();
    const first = harness(handle, store);
    await first.internal("load");
    await first.call("edit", { text: "new text" });
    const snapshot = {
      id: first.doc.editSliceId,
      revision: first.doc.editRevision,
      fingerprint: first.doc.fileFingerprint,
      sourceHash: first.doc.sourceHash,
      index: first.doc.virtualPageIndex,
      start: first.doc.pageStart, end: first.doc.pageEnd
    };
    const second = harness(handle, store);
    second.doc.pendingRecovery = snapshot;
    assert.equal((await second.internal("load")).ok, true);
    assert.equal(second.doc.status, "yellow");
    assert.equal(second.doc.text, "new text");
    assert.equal(second.doc.editRevision, 1);
    assert.equal((await second.call("save")).ok, true);
    assert.equal(await (await handle.getFile()).text(), "new text");
  });

test("Patch19 rejects recovered edit on externally changed source",
  async () => {
    const handle = handleOf("old");
    const store = storage();
    const first = harness(handle, store);
    await first.internal("load");
    await first.call("edit", { text: "new" });
    const pending = {
      id: first.doc.editSliceId,
      revision: first.doc.editRevision,
      fingerprint: first.doc.fileFingerprint,
      sourceHash: first.doc.sourceHash,
      index: 0, start: first.doc.pageStart, end: first.doc.pageEnd
    };
    // Synthetic mismatched fingerprint: no journal is discarded.
    pending.fingerprint = "invalid";
    const second = harness(handle, store);
    second.doc.pendingRecovery = pending;
    assert.equal((await second.internal("load")).status, 409);
    assert.equal(store.entries.size, 1);
  });

test("Patch19 UTF-16 minimal edit accepts Chinese and emoji",
  async () => {
    const { doc, call, internal } = harness(handleOf("A😀中B"));
    await internal("load");
    const result = await call("edit", { text: "A😀中改B" });
    assert.equal(result.ok, true, result.error);
    assert.equal(doc.pieceIndex.length, "A😀中改B".length);
    assert.equal(doc.text, "A😀中改B");
  });
