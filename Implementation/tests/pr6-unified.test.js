import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { Explorer } from "../object/Explorer.js";

test("unified Explorer tree shows an opened folder file once", async () => {
  const core = new LinkCore();
  const workspace = new FileWorkspace(core, () => {});
  const explorer = new Explorer(core);
  core.register({ id: "tester", receive: async () => null,
    authorization: { default: "Public" } });
  const file = {
    kind: "file", name: "a.txt",
    async isSameEntry(other) { return other === this; }
  };
  const directory = {
    kind: "directory", name: "root",
    async *values() { yield file; }
  };
  const root = await core.request("tester", "explorer",
    "importFolder", { handle: directory });
  assert.equal(root.ok, true);
  const id = workspace.create();
  workspace.active.name = "a.txt";
  workspace.active.handle = file;
  const result = await core.request("tester", "explorer", "list");
  assert.equal(result.ok, true);
  assert.equal(result.value.length, 1);
  assert.equal(result.value[0].children.length, 1);
  assert.equal(result.value[0].children[0].documentId, id);
  const repeated = await core.request("tester", "explorer",
    "openEntry", { id: result.value[0].children[0].id });
  assert.equal(repeated.ok, true);
  assert.equal(workspace.documents.length, 1);
});

test("unattached tabs share the same tree without second heading", async () => {
  const core = new LinkCore();
  const workspace = new FileWorkspace(core, () => {});
  new Explorer(core);
  core.register({ id: "tester", receive: async () => null,
    authorization: { default: "Public" } });
  const id = workspace.create();
  const listed = await core.request("tester", "explorer", "list");
  assert.deepEqual(listed.value.map(x => x.id), ["tab:" + id]);
});
