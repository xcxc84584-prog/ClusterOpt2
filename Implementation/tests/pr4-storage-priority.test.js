import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { DocumentStatus } from "../property/DocumentStatus.js";

function makeHandle(name, initial) {
  let text = initial;
  let version = 1000;
  return {
    name,
    async getFile() {
      const blob = new Blob([text]);
      return {
        name, size: blob.size, lastModified: version,
        stream: () => blob.stream()
      };
    },
    async createWritable() {
      const chunks = [];
      return {
        async write(chunk) { chunks.push(chunk); },
        async close() {
          text = await new Blob(chunks).text();
          version++;
        },
        async abort() {}
      };
    },
    externalUpdate(value) { text = value; version++; },
    content() { return text; }
  };
}

test("ExternalFirst reloads an externally overwritten file", async () => {
  const core = new LinkCore();
  const workspace = new FileWorkspace(core, () => {});
  const handle = makeHandle("external.txt", "disk old");
  await workspace.open([handle]);
  workspace.active.text = "local draft";
  workspace.active.status = DocumentStatus.DIRTY;
  workspace.setPriority("external");
  handle.externalUpdate("disk new");
  await workspace.syncExternal();
  assert.equal(workspace.active.text, "disk new");
  assert.equal(workspace.active.status, DocumentStatus.SYNCED);
});

test("InternalFirst retains editor content and can overwrite external", async () => {
  const core = new LinkCore();
  const workspace = new FileWorkspace(core, () => {});
  const handle = makeHandle("internal.txt", "disk old");
  await workspace.open([handle]);
  workspace.active.text = "local draft";
  workspace.active.status = DocumentStatus.DIRTY;
  workspace.setPriority("internal");
  handle.externalUpdate("disk new");
  await workspace.syncExternal();
  assert.equal(workspace.active.text, "local draft");
  assert.equal(workspace.active.status, DocumentStatus.DIRTY);
  await workspace.save();
  assert.equal(handle.content(), "local draft");
});

test("ExternalFirst pre-save conflict does not overwrite disk", async () => {
  const core = new LinkCore();
  const workspace = new FileWorkspace(core, () => {});
  const handle = makeHandle("conflict.txt", "disk old");
  await workspace.open([handle]);
  workspace.active.text = "local draft";
  workspace.active.status = DocumentStatus.DIRTY;
  workspace.setPriority("external");
  handle.externalUpdate("disk newer");
  assert.equal(await workspace.save(), false);
  assert.equal(handle.content(), "disk newer");
  assert.equal(workspace.active.text, "disk newer");
});

test("Invalid shared StoragePriority is rejected with a typed 400", () => {
  const core = new LinkCore();
  const workspace = new FileWorkspace(core, () => {});
  assert.throws(() => workspace.setPriority("invalid"), error =>
    error instanceof TypeError && error.status === 400);
});
