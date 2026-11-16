import test from "node:test";
import assert from "node:assert/strict";
import { FileDocument } from "../object/FileDocument.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { DocumentStatus } from "../property/DocumentStatus.js";
import { LinkCore } from "../LinkCore/LinkCore.js";

function memoryHandle(name, initial = "") {
  let text = initial;
  return {
    name,
    async isSameEntry(other) { return this === other; },
    async getFile() {
      const blob = new Blob([text], { type: "text/plain" });
      Object.defineProperty(blob, "name", { value: name });
      return blob;
    },
    async createWritable() {
      const chunks = [];
      return {
        async write(data) { chunks.push(new Uint8Array(data)); },
        async close() {
          const blob = new Blob(chunks);
          text = await blob.text();
        },
        async abort() { chunks.length = 0; }
      };
    },
    value() { return text; }
  };
}

test("FileDocument load reports progress and preserves UTF-8", async () => {
  const handle = memoryHandle("sample.txt", "ABC\n繁體中文");
  const doc = new FileDocument(handle.name, handle);
  const progress = [];
  await doc.load(value => progress.push(value));
  assert.equal(doc.text, "ABC\n繁體中文");
  assert.equal(doc.status, DocumentStatus.SYNCED);
  assert.equal(progress.at(-1), 100);
});

test("FileDocument saves edits and reports 100 percent", async () => {
  const handle = memoryHandle("draft.txt");
  const doc = new FileDocument("draft.txt");
  await doc.receive("edit", { text: "new contents" });
  const percentages = [];
  await doc.receive("save", {
    handle, onProgress: value => percentages.push(value)
  });
  assert.equal(handle.value(), "new contents");
  assert.equal(doc.status, DocumentStatus.SYNCED);
  assert.equal(percentages.at(-1), 100);
});

test("Save error is recorded without overwriting a previous file", async () => {
  const handle = {
    name: "restricted.txt",
    async createWritable() { throw new Error("Permission denied"); }
  };
  const doc = new FileDocument(handle.name, handle);
  await doc.receive("edit", { text: "not saved" });
  await assert.rejects(doc.save(), /Permission denied/);
  assert.equal(doc.status, DocumentStatus.ERROR);
  assert.equal(doc.text, "not saved");
});

test("Workspace loads authorized files, prevents duplicates and closes", async () => {
  const core = new LinkCore();
  const changes = [];
  const workspace = new FileWorkspace(core, () => changes.push(1));
  core.register({ id: "ui", receive: async () => null });
  const handle = memoryHandle("one.txt", "test");
  const result = await core.request("ui", "workspace", "open", {
    handles: [handle, handle]
  });
  assert.equal(result.status, 200);
  assert.equal(workspace.documents.length, 1);
  assert.equal(workspace.active.text, "test");
  const saved = await core.request("ui", "workspace", "save");
  assert.equal(saved.status, 200);
  assert.equal(workspace.close(), true);
  assert.equal(workspace.documents.length, 0);
  assert.ok(changes.length > 0);
});

test("File save chunks large output and can round-trip", async () => {
  const text = "字abc".repeat(100000);
  const handle = memoryHandle("large.txt");
  const doc = new FileDocument(handle.name);
  await doc.receive("edit", { text });
  const progress = [];
  await doc.save(handle, value => progress.push(value));
  assert.equal(handle.value(), text);
  assert.ok(progress.length > 2);
  assert.equal(progress.at(-1), 100);
});

test("CRLF and UTF-8 BOM survive a text editing round-trip", async () => {
  const raw = "\uFEFFline 1\r\nline 2\r\n";
  const handle = memoryHandle("windows.txt", raw);
  const doc = new FileDocument(handle.name, handle);
  await doc.load();
  assert.equal(doc.text, "line 1\nline 2\n");
  assert.equal(doc.lineEnding, "\r\n");
  assert.equal(doc.hasUtf8Bom, true);
  await doc.save();
  assert.equal(handle.value(), raw);
});

test("Unsupported byte encodings fail instead of silently corrupting", async () => {
  const handle = {
    name: "binary.txt",
    async getFile() {
      const blob = new Blob([new Uint8Array([0xff, 0xfe, 0x00])]);
      Object.defineProperty(blob, "name", { value: "binary.txt" });
      return blob;
    }
  };
  const doc = new FileDocument(handle.name, handle);
  await assert.rejects(doc.load());
  assert.equal(doc.status, DocumentStatus.ERROR);
});
