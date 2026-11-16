import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { SliceRecoveryJournal } from "../object/SliceRecoveryJournal.js";
import { SliceEditTransaction } from "../object/SliceEditTransaction.js";
import { SliceBatchWritebackUnit } from "../object/SliceBatchWritebackUnit.js";
import { VirtualFileDocument } from "../object/VirtualFileDocument.js";

function memoryStore() {
  const entries = new Map();
  return {
    entries,
    async get(id) { return structuredClone(entries.get(id)); },
    async putIfNewer(entry) {
      const old = entries.get(entry.id);
      if (old && old.revision >= entry.revision) {
        const error = new Error("Stale revision");
        error.status = 409;
        throw error;
      }
      entries.set(entry.id, structuredClone(entry));
    },
    async deleteIfMatch(id, revision, checksum) {
      const old = entries.get(id);
      if (!old || old.revision !== revision ||
          old.checksum !== checksum) {
        const error = new Error("Checkpoint conflict");
        error.status = 409;
        throw error;
      }
      entries.delete(id);
    }
  };
}

function makeHandle(text) {
  let bytes = new TextEncoder().encode(text);
  let changedAt = 100;
  const stats = { writes: 0, openedWithExisting: false };
  return {
    name: "multi-page.txt", stats,
    tamperSameMetadata(content) {
      const replacement = new TextEncoder().encode(content);
      if (replacement.length !== bytes.length) {
        throw new Error("Tamper must keep byte size");
      }
      bytes = replacement;
    },
    async getFile() {
      const blob = new Blob([bytes]);
      Object.defineProperty(blob, "lastModified", {
        value: changedAt
      });
      return blob;
    },
    async createWritable({ keepExistingData = false } = {}) {
      stats.openedWithExisting = keepExistingData;
      let target = keepExistingData ? bytes.slice() :
        new Uint8Array();
      let closed = false;
      return {
        async write(piece) {
          stats.writes++;
          const offset = piece?.type === "write" ?
            piece.position : target.length;
          const data = piece?.type === "write" ?
            new Uint8Array(piece.data) : piece instanceof Blob ?
              new Uint8Array(await piece.arrayBuffer()) :
              new Uint8Array(piece);
          const next = new Uint8Array(
            Math.max(target.length, offset + data.length));
          next.set(target);
          next.set(data, offset);
          target = next;
        },
        async close() {
          bytes = target;
          changedAt++;
          closed = true;
        },
        async abort() {
          if (closed) throw new Error("Already committed");
        }
      };
    }
  };
}

function setup(text, store = memoryStore(), handle = makeHandle(text)) {
  const core = new LinkCore();
  core.register({ id: "ui", receive: async () => true });
  core.register({ id: "workspace", receive: async () => true });
  new SliceRecoveryJournal(core, store);
  new SliceEditTransaction(core);
  new SliceBatchWritebackUnit(core);
  const doc = new VirtualFileDocument(handle.name, handle, core);
  assert.ok(core.register(doc));
  const request = (action, payload = {}) =>
    core.request("ui", doc.id, action, payload, { origin: "user" });
  return { core, doc, store, handle, request };
}

const source = "A\n".repeat(32768) + "B\nTAIL";

test("Patch19 Fix4: edit across two pages without an interim Save",
  async () => {
    const { doc, store, handle, request } = setup(source);
    assert.equal((await request("load")).ok, false);
    const opened = await doc.core.request(
      "workspace", doc.id, "load");
    assert.equal(opened.ok, true, opened.error);
    assert.equal((await request("edit", {
      text: "Z" + doc.text.slice(1)
    })).ok, true);
    const firstId = doc.editSliceId;
    assert.equal((await request("page", { index: 1 })).ok, true);
    assert.equal(doc.pageFirstLine, 32769);
    assert.equal((await request("edit", {
      text: "Q" + doc.text.slice(1)
    })).ok, true);
    assert.equal(doc.dirtyPages.size, 2);
    assert.equal(store.entries.size, 2);
    assert.equal((await request("page", { index: 0 })).ok, true);
    assert.equal(doc.text[0], "Z");
    assert.equal(doc.editSliceId, firstId);
    assert.equal(doc.status, "yellow");
    const saved = await request("save");
    assert.equal(saved.ok, true, saved.error);
    assert.equal(doc.status, "green");
    assert.equal(doc.dirtyPages.size, 0);
    assert.equal(store.entries.size, 0);
    assert.equal((await (await handle.getFile()).text()),
      "Z" + source.slice(1, 65536) + "Q\nTAIL");
    assert.equal(handle.stats.openedWithExisting, true);
    assert.equal(handle.stats.writes, 2);
    assert.ok(doc.core.getSnapshot().dependencies.some(item =>
      item.link === doc.id + "->slice-batch-writeback-unit" &&
      item.code === "10"));
  });

test("Patch19 Fix4: length-changing two-page edits use Blob spans",
  async () => {
    const { doc, request, handle } = setup(source);
    await doc.core.request("workspace", doc.id, "load");
    await request("edit", { text: "🐱" + doc.text.slice(1) });
    await request("page", { index: 1 });
    await request("edit", { text: "😀" + doc.text.slice(1) });
    const save = await request("save");
    assert.equal(save.ok, true, save.error);
    assert.equal(handle.stats.openedWithExisting, false);
    assert.equal(await (await handle.getFile()).text(),
      "🐱" + source.slice(1, 65536) + "😀\nTAIL");
  });

test("Patch19 Fix4: prior dirty newline updates next-page line index",
  async () => {
    const { doc, request } = setup(source);
    await doc.core.request("workspace", doc.id, "load");
    await request("edit", { text: "\n" + doc.text });
    assert.equal((await request("page", { index: 1 })).ok, true);
    assert.equal(doc.pageFirstLine, 32770);
  });

test("Patch19 Fix4: cancelled multi-page write keeps original bytes",
  async () => {
    const { doc, request, handle, store } = setup(source);
    await doc.core.request("workspace", doc.id, "load");
    await request("edit", { text: "Z" + doc.text.slice(1) });
    await request("page", { index: 1 });
    await request("edit", { text: "Q" + doc.text.slice(1) });
    const cancel = new AbortController();
    const result = await request("save", {
      signal: cancel.signal,
      onProgress: completed => {
        if (completed > 0) cancel.abort();
      }
    });
    assert.equal(result.status, 499);
    assert.equal(doc.dirtyPages.size, 2);
    assert.equal(store.entries.size, 2);
    assert.equal(await (await handle.getFile()).text(), source);
  });

test("Patch19 Fix4: reloaded hidden dirty page is restored on Save",
  async () => {
    const handle = makeHandle(source);
    const store = memoryStore();
    const first = setup(source, store, handle);
    await first.doc.core.request("workspace", first.doc.id, "load");
    await first.request("edit", {
      text: "Z" + first.doc.text.slice(1)
    });
    await first.request("page", { index: 1 });
    await first.request("edit", {
      text: "Q" + first.doc.text.slice(1)
    });
    const checkpoints = [...first.doc.dirtyPages.values()].map(
      entry => ({
        id: entry.id, revision: entry.revision,
        fingerprint: first.doc.fileFingerprint,
        sourceHash: entry.sourceHash,
        index: entry.index, start: entry.start, end: entry.end,
        baselineLineBreaks: entry.baselineLineBreaks,
        editedLineBreaks: entry.editedLineBreaks
      })
    );
    const reopened = setup(source, store, handle);
    for (const record of checkpoints) {
      reopened.doc.pendingRecoveries.set(record.index, record);
    }
    const loaded = await reopened.doc.core.request("workspace",
      reopened.doc.id, "load", { index: 1 });
    assert.equal(loaded.ok, true, loaded.error);
    assert.equal(reopened.doc.dirtyPages.size, 1);
    assert.equal(reopened.doc.pendingRecoveries.size, 1);
    const saved = await reopened.request("save");
    assert.equal(saved.ok, true, saved.error);
    assert.equal(store.entries.size, 0);
    assert.equal(reopened.doc.dirtyPages.size, 0);
    assert.equal(await (await handle.getFile()).text(),
      "Z" + source.slice(1, 65536) + "Q\nTAIL");
  });

test("Patch19 Fix4: same-metadata dirty byte tampering returns EHU409",
  async () => {
    const { doc, request, handle, store, core } = setup(source);
    await doc.core.request("workspace", doc.id, "load");
    await request("edit", { text: "Z" + doc.text.slice(1) });
    handle.tamperSameMetadata("X" + source.slice(1));
    const saved = await request("save");
    assert.equal(saved.status, 409);
    assert.equal(doc.status, "yellow");
    assert.equal(store.entries.size, 1);
    assert.ok(core.getSnapshot().logs.some(entry =>
      entry.kind === "EHU" && entry.status === 409));
  });
