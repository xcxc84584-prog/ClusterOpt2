import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { Explorer } from "../object/Explorer.js";

function fixture() {
  const core = new LinkCore();
  const workspace = new FileWorkspace(core, () => {});
  new Explorer(core);
  core.register({ id: "tester", receive: async () => null,
    authorization: { default: "Public" } });
  return { core, workspace };
}

test("PR7 sibling drag order survives snapshot and root restore", async () => {
  const { core } = fixture();
  const root = { kind: "directory", name: "project",
    async *values() {
      for (const name of ["a.txt", "b.txt", "c.txt"]) {
        yield { kind: "file", name };
      }
    }
  };
  const imported = await core.request("tester", "explorer",
    "importFolder", { handle: root });
  assert.equal(imported.ok, true);
  const before = await core.request("tester", "explorer", "list");
  const children = before.value[0].children;
  const moved = await core.request("tester", "explorer", "reorder", {
    sourceId: children[2].id, targetId: children[0].id
  });
  assert.equal(moved.ok, true);
  const reordered = await core.request("tester", "explorer", "list");
  assert.deepEqual(reordered.value[0].children.map(x => x.name),
    ["c.txt", "a.txt", "b.txt"]);
  const snapshot = await core.request("tester", "explorer", "snapshotRoots");
  assert.deepEqual(snapshot.value[0].orders[""],
    ["c.txt:file", "a.txt:file", "b.txt:file"]);
  const another = fixture();
  const restored = await another.core.request("tester", "explorer",
    "restoreRoots", { roots: snapshot.value });
  assert.equal(restored.ok, true);
  const list = await another.core.request("tester", "explorer", "list");
  assert.deepEqual(list.value[0].children.map(x => x.name),
    ["c.txt", "a.txt", "b.txt"]);
});

test("PR7 unattached tab drag reorders workspace documents", async () => {
  const { core, workspace } = fixture();
  const first = workspace.create();
  const second = workspace.create();
  const reordered = await core.request("tester", "explorer", "reorder", {
    sourceId: "tab:" + second, targetId: "tab:" + first
  });
  assert.equal(reordered.ok, true);
  assert.deepEqual(workspace.documents.map(doc => doc.id), [second, first]);
});
