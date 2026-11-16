import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { Explorer } from "../object/Explorer.js";

function folder(name) {
  const entries = new Map();
  return {
    kind: "directory", name, entries,
    async *values() { yield* entries.values(); },
    async getFileHandle(child, { create = false } = {}) {
      if (!entries.has(child) && create) {
        entries.set(child, {
          kind: "file", name: child,
          async getFile() { return new Blob(["text"]); },
          async createWritable() {
            return { async write() {}, async close() {} };
          }
        });
      }
      if (!entries.has(child)) throw new Error("Missing entry");
      return entries.get(child);
    },
    async getDirectoryHandle(child, { create = false } = {}) {
      if (!entries.has(child) && create) {
        entries.set(child, folder(child));
      }
      if (!entries.has(child)) throw new Error("Missing entry");
      return entries.get(child);
    },
    async removeEntry(child) { entries.delete(child); }
  };
}

function setup() {
  const core = new LinkCore();
  new FileWorkspace(core, () => {});
  const explorer = new Explorer(core);
  core.register({
    id: "test-ui", receive: async () => null,
    authorization: { default: "Public" }
  });
  return { core, explorer };
}

test("PR8+20 Explorer CRUD follows Hub EventChain and rejects collisions",
  async () => {
    const { core, explorer } = setup();
    const root = folder("workspace");
    const imported = await core.request("test-ui", "explorer",
      "importFolder", { handle: root });
    assert.equal(imported.ok, true);
    const id = imported.value;
    const created = await core.request("test-ui", "explorer",
      "createFile", { id, name: "notes.md" });
    assert.equal(created.ok, true);
    assert.equal(root.entries.has("notes.md"), true);
    const collision = await core.request("test-ui", "explorer",
      "createFile", { id, name: "notes.md" });
    assert.equal(collision.status, 409);
    const invalid = await core.request("test-ui", "explorer",
      "createFolder", { id, name: "../escape" });
    assert.equal(invalid.status, 400);
    const fileId = explorer.findNode(id).children[0].id;
    const renamed = await core.request("test-ui", "explorer",
      "renameEntry", { id: fileId, name: "renamed.md" });
    assert.equal(renamed.ok, true);
    assert.equal(root.entries.has("notes.md"), false);
    assert.equal(root.entries.has("renamed.md"), true);
    const renamedId = explorer.findNode(id).children[0].id;
    const denied = await core.request("test-ui", "explorer",
      "deleteEntry", { id: renamedId });
    assert.equal(denied.ok, false);
    assert.equal(root.entries.has("renamed.md"), true);
    const deleted = await core.request("test-ui", "explorer",
      "deleteEntry", { id: renamedId, confirmed: true });
    assert.equal(deleted.ok, true);
    assert.equal(root.entries.has("renamed.md"), false);
    assert.equal(core.getSnapshot().logs.some(log =>
      log.kind === "EHU" || log.status >= 400), true);
  });

test("PR8+20 create nested folder and copy require valid destinations",
  async () => {
    const { core } = setup();
    const root = folder("workspace");
    const opened = await core.request("test-ui", "explorer",
      "importFolder", { handle: root });
    const result = await core.request("test-ui", "explorer",
      "createFolder", { id: opened.value, name: "docs" });
    assert.equal(result.ok, true);
    assert.equal(root.entries.get("docs")?.kind, "directory");
  });
