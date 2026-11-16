import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { SliceRecoveryJournal } from "../object/SliceRecoveryJournal.js";
import { SliceEditTransaction } from "../object/SliceEditTransaction.js";

function memoryStore() {
  const entries = new Map();
  return {
    entries,
    failWrite: false,
    async get(id) {
      const item = entries.get(id);
      return item && structuredClone(item);
    },
    async put(entry) {
      if (this.failWrite) {
        const error = new Error("Simulated quota failure");
        error.status = 503;
        throw error;
      }
      entries.set(entry.id, structuredClone(entry));
    },
    async delete(id) { entries.delete(id); }
  };
}

function setup(store) {
  const core = new LinkCore();
  core.register({ id: "ui", receive: async () => true });
  new SliceRecoveryJournal(core, store);
  new SliceEditTransaction(core);
  const call = (target, action, payload = {}) => core.request(
    "ui", target, action, payload, { origin: "user" });
  const edit = (action, payload = {}) =>
    call("slice-edit-transaction", action, payload);
  return { core, call, edit };
}

test("Patch16 durable transaction survives a new object runtime", async () => {
  const store = memoryStore();
  const first = setup(store);
  assert.equal((await first.edit("open", {
    id: "replay", text: "hello"
  })).ok, true);
  const wrote = await first.edit("transactDurable", {
    id: "replay", revision: 0,
    operations: [{ type: "insert", start: 5, text: " 世界" }]
  });
  assert.equal(wrote.ok, true, wrote.error);
  assert.equal(wrote.value.revision, 1);
  assert.equal(wrote.value.durable, true);

  const second = setup(store);
  const restored = await second.edit("restoreDurable", {
    id: "replay"
  });
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.value.revision, 1);
  assert.equal(restored.value.dirty, true);
  const text = await second.edit("read", {
    id: "replay", start: 0, end: 8
  });
  assert.equal(text.value, "hello 世界");
  assert.equal((await second.edit("close", {
    id: "replay"
  })).status, 409);
});

test("Patch16 failed IndexedDB-like write never publishes edit", async () => {
  const store = memoryStore();
  const { edit } = setup(store);
  await edit("open", { id: "failure", text: "safe" });
  store.failWrite = true;
  const failed = await edit("transactDurable", {
    id: "failure", revision: 0,
    operations: [{ type: "insert", start: 4, text: "?" }]
  });
  assert.equal(failed.status, 503);
  const state = await edit("info", { id: "failure" });
  assert.equal(state.value.revision, 0);
  assert.equal(state.value.dirty, false);
  assert.equal((await edit("read", {
    id: "failure", start: 0, end: 4
  })).value, "safe");
});

test("Patch16 SHA-256 rejects corrupted checkpoint", async () => {
  const store = memoryStore();
  const { edit, call } = setup(store);
  await edit("open", { id: "corrupt", text: "one" });
  assert.equal((await edit("transactDurable", {
    id: "corrupt", revision: 0,
    operations: [{ type: "insert", start: 3, text: " two" }]
  })).ok, true);
  const journal = store.entries.get("corrupt");
  journal.text = "tampered";
  const bad = await call("slice-recovery-journal", "restore", {
    id: "corrupt"
  });
  assert.equal(bad.status, 422);
});

test("Patch16 journal rejects stale revision and unauthorized mutation",
  async () => {
    const store = memoryStore();
    const { edit, call } = setup(store);
    await edit("open", { id: "guard", text: "abc" });
    assert.equal((await edit("transactDurable", {
      id: "guard", revision: 0,
      operations: [{ type: "insert", start: 3, text: "d" }]
    })).ok, true);
    assert.equal((await edit("transactDurable", {
      id: "guard", revision: 0,
      operations: [{ type: "insert", start: 4, text: "e" }]
    })).status, 409);
    assert.equal((await call("slice-recovery-journal",
      "discard", { id: "guard" })).status, 403);
    assert.equal((await call("slice-recovery-journal",
      "persist", { id: "guard", text: "bad", revision: 2 }
    )).status, 403);
    assert.equal((await call("slice-recovery-journal",
      "restore", { id: "missing" })).status, 404);
  });
