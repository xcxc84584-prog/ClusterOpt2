import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { VirtualFileDocument } from "../object/VirtualFileDocument.js";
import { SliceRecoveryJournal } from "../object/SliceRecoveryJournal.js";
import { SliceEditTransaction } from "../object/SliceEditTransaction.js";
import { SliceBatchWritebackUnit } from "../object/SliceBatchWritebackUnit.js";

function sourceHandle(text) {
  let bytes = new TextEncoder().encode(text);
  let mtime = 170;
  return {
    name: "rebase.txt",
    replace(text) {
      bytes = new TextEncoder().encode(text);
      mtime++;
    },
    async getFile() {
      const file = new Blob([bytes]);
      Object.defineProperty(file, "lastModified", { value: mtime });
      return file;
    }
  };
}

function fixture(handle) {
  const core = new LinkCore();
  const journal = new Map();
  core.register({ id: "ui", receive: () => true });
  core.register({ id: "workspace", receive: () => true });
  new SliceRecoveryJournal(core, {
    async get(id) { return structuredClone(journal.get(id)); },
    async putIfNewer(entry) { journal.set(entry.id, structuredClone(entry)); },
    async deleteIfMatch(id, revision, checksum) {
      const entry = journal.get(id);
      if (entry?.revision !== revision ||
          entry.checksum !== checksum) throw new Error("Wrong checkpoint");
      journal.delete(id);
    }
  });
  new SliceEditTransaction(core);
  new SliceBatchWritebackUnit(core);
  const doc = new VirtualFileDocument(handle.name, handle, core);
  assert.equal(core.register(doc), true);
  const internal = (action, payload = {}) =>
    core.request("workspace", doc.id, action, payload);
  const call = (action, payload = {}) =>
    core.request("ui", doc.id, action, payload, { origin: "user" });
  return { doc, call, internal, core, journal };
}

test("Patch19 Fix5 clean page follows externally changed file generation", async () => {
  const source = "A\n".repeat(32768) + "OLD";
  const handle = sourceHandle(source);
  const { doc, internal, call, core } = fixture(handle);
  assert.equal((await internal("load")).ok, true);
  assert.equal(doc.pageFirstLine, 1);
  handle.replace(source.slice(0, 65536) + "NEW");
  const turned = await call("page", { index: 1 });
  assert.equal(turned.ok, true, turned.error);
  assert.equal(doc.text, "NEW");
  assert.equal(doc.status, "green");
  assert.equal(doc.pageFirstLine, 32769);
  assert.equal(core.getSnapshot().logs.some(event =>
    event.kind === "EHU" && event.action === "Response.page" &&
    event.status === 409), false);
});

test("Patch19 Fix5 dirty page still rejects external changes with EHU409", async () => {
  const source = "A\n".repeat(32768) + "OLD";
  const handle = sourceHandle(source);
  const { doc, internal, call, core, journal } = fixture(handle);
  assert.equal((await internal("load")).ok, true);
  assert.equal((await call("edit", {
    text: "B" + doc.text.slice(1)
  })).ok, true);
  const original = doc.text;
  handle.replace(source.slice(0, 65536) + "NEW");
  const result = await call("page", { index: 1 });
  assert.equal(result.status, 409);
  assert.equal(doc.text, original);
  assert.equal(doc.status, "yellow");
  assert.equal(doc.dirtyPages.size, 1);
  assert.equal(journal.size, 1);
  assert.ok(core.getSnapshot().logs.some(event =>
    event.kind === "EHU" && event.action === "Response.page" &&
    event.status === 409));
});

test("Patch19 Fix5 changed lastModified clears old line checkpoint", async () => {
  const source = "x\n".repeat(32768) + "TAIL";
  const handle = sourceHandle(source);
  const { doc, internal, call } = fixture(handle);
  assert.equal((await internal("load")).ok, true);
  assert.equal((await call("page", { index: 1 })).ok, true);
  assert.equal(doc.pageFirstLine, 32769);
  // The next on-disk generation has one fewer newline before page 1.
  handle.replace("x_".repeat(32768) + "TAIL");
  assert.equal((await call("page", { index: 0 })).ok, true);
  assert.equal((await call("page", { index: 1 })).ok, true);
  assert.equal(doc.pageFirstLine, 1);
});
