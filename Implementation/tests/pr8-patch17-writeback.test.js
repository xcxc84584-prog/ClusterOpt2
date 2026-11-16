import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { SliceRecoveryJournal } from "../object/SliceRecoveryJournal.js";
import { SliceEditTransaction } from "../object/SliceEditTransaction.js";
import { SliceWritebackUnit } from "../object/SliceWritebackUnit.js";
import { SliceFileWritePolicy } from "../property/SliceFileWritePolicy.js";

function memoryStore() {
  const entries = new Map();
  return {
    entries,
    async get(id) { return structuredClone(entries.get(id)); },
    async putIfNewer(entry) {
      const last = entries.get(entry.id);
      if (last && last.revision >= entry.revision) {
        const error = new Error("Stale");
        error.status = 409;
        throw error;
      }
      entries.set(entry.id, structuredClone(entry));
    },
    async deleteIfMatch(id, revision, checksum) {
      const existing = entries.get(id);
      if (!existing || existing.revision !== revision ||
          existing.checksum !== checksum) {
        const error = new Error("Journal revision moved");
        error.status = 409;
        throw error;
      }
      entries.delete(id);
    },
    async delete(id) { entries.delete(id); }
  };
}

function fakeHandle(initial, options = {}) {
  let bytes = new TextEncoder().encode(initial);
  let modified = 1000;
  let failed = false;
  return {
    get currentText() { return new TextDecoder().decode(bytes); },
    get failed() { return failed; },
    async getFile() {
      const snapshot = new Blob([bytes.slice()]);
      Object.defineProperty(snapshot, "lastModified", {
        value: modified
      });
      return snapshot;
    },
    async createWritable(config) {
      assert.equal(config.mode, "exclusive");
      assert.equal(config.keepExistingData, false);
      const chunks = [];
      return {
        async write(chunk) {
          if (options.failWrite) {
            failed = true;
            throw new Error("Mock write failure");
          }
          chunks.push(new Uint8Array(chunk));
        },
        async close() {
          const next = Uint8Array.from(chunks.flatMap(chunk => [...chunk]));
          bytes = options.corruptReadback ?
            Uint8Array.from(next, byte => byte === 87 ? 88 : byte) : next;
          modified++;
        },
        async abort() { failed = true; }
      };
    }
  };
}

function setup(store) {
  const core = new LinkCore();
  core.register({ id: "ui", receive: async () => true });
  new SliceRecoveryJournal(core, store);
  new SliceWritebackUnit(core);
  new SliceEditTransaction(core);
  const call = (target, action, payload = {}) =>
    core.request("ui", target, action, payload, { origin: "user" });
  const edit = (action, payload) =>
    call("slice-edit-transaction", action, payload);
  return { core, edit, call };
}

async function saveCandidate(edit, id = "patch17") {
  assert.equal((await edit("open", { id, text: "world" })).ok, true);
  const response = await edit("transactDurable", {
    id, revision: 0, operations: [{
      type: "replace", start: 0, end: 5, text: "WORLD!"
    }]
  });
  assert.equal(response.ok, true, response.error);
}

async function filePayload(handle, id = "patch17") {
  const file = await handle.getFile();
  return {
    id, handle, revision: 1, start: 6, end: 11,
    expectedSize: file.size, expectedLastModified: file.lastModified,
    expectedSliceHash: await SliceFileWritePolicy.digest(
      await file.slice(6, 11).arrayBuffer())
  };
}

test("Patch17 verifies splice, retires journal, permits clean close",
  async () => {
    const store = memoryStore();
    const { core, edit, call } = setup(store);
    await saveCandidate(edit);
    const handle = fakeHandle("hello\\nworld\\nEND".replace(/\\n/g, "\n"));
    const result = await edit("commitWriteback",
      await filePayload(handle));
    assert.equal(result.ok, true, result.error);
    assert.equal(result.value.dirty, false);
    assert.equal(result.value.receipt.verified, true);
    assert.equal(handle.currentText, "hello\nWORLD!\nEND");
    assert.equal(store.entries.has("patch17"), false);
    assert.equal((await edit("close", { id: "patch17" })).ok, true);
    assert.equal((await call("slice-writeback-unit", "commit", {
      id: "patch17"
    })).status, 403);
    const snapshot = core.getSnapshot();
    assert.ok(snapshot.dependencies.some(item =>
      item.link === "slice-edit-transaction->slice-writeback-unit" &&
      item.code === "10"));
    assert.ok(snapshot.dependencies.some(item =>
      item.link === "slice-writeback-unit->slice-edit-transaction" &&
      item.code === "01"));
  });

test("Patch17 rejects stale file and preserves dirty journal",
  async () => {
    const store = memoryStore();
    const { edit } = setup(store);
    await saveCandidate(edit);
    const handle = fakeHandle("hello\nworld\nEND");
    const payload = await filePayload(handle);
    payload.expectedLastModified--;
    const response = await edit("commitWriteback", payload);
    assert.equal(response.status, 409);
    assert.equal((await edit("info", {
      id: "patch17"
    })).value.dirty, true);
    assert.equal(store.entries.has("patch17"), true);
    assert.equal(handle.currentText, "hello\nworld\nEND");
  });

test("Patch17 aborts failed writer and retains recovery checkpoint",
  async () => {
    const store = memoryStore();
    const { edit } = setup(store);
    await saveCandidate(edit);
    const handle = fakeHandle("hello\nworld\nEND", {
      failWrite: true
    });
    assert.equal((await edit("commitWriteback",
      await filePayload(handle))).status, 503);
    assert.equal(handle.failed, true);
    assert.equal(handle.currentText, "hello\nworld\nEND");
    assert.equal(store.entries.has("patch17"), true);
    assert.equal((await edit("close", {
      id: "patch17"
    })).status, 409);
  });

test("Patch17 rejects post-write readback corruption, retains journal",
  async () => {
    const store = memoryStore();
    const { edit } = setup(store);
    await saveCandidate(edit);
    const handle = fakeHandle("hello\nworld\nEND", {
      corruptReadback: true
    });
    const response = await edit("commitWriteback",
      await filePayload(handle));
    assert.equal(response.status, 422);
    assert.equal(store.entries.has("patch17"), true);
    assert.equal((await edit("info", {
      id: "patch17"
    })).value.dirty, true);
  });

test("Patch17 refuses non-durable edits and unmatched revision",
  async () => {
    const store = memoryStore();
    const { edit } = setup(store);
    await edit("open", { id: "volatile", text: "A" });
    await edit("transact", { id: "volatile", revision: 0,
      operations: [{ type: "insert", start: 1, text: "B" }] });
    const handle = fakeHandle("A");
    const wrong = await edit("commitWriteback", {
      id: "volatile", handle, revision: 1
    });
    assert.equal(wrong.status, 409);
    await saveCandidate(edit, "stale");
    const response = await edit("commitWriteback", {
      ...await filePayload(fakeHandle("hello\nworld\nEND"), "stale"),
      revision: 0
    });
    assert.equal(response.status, 409);
  });
