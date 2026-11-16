import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { Explorer } from "../object/Explorer.js";

test("expanded Explorer root detects external file CRUD", async () => {
  const core = new LinkCore();
  new FileWorkspace(core, () => {});
  new Explorer(core);
  core.register({ id: "tester", receive: async () => null,
    authorization: { default: "Public" } });
  let files = [{ kind: "file", name: "a.txt" }];
  const root = { kind: "directory", name: "project",
    async *values() { for (const item of files) yield item; } };
  const imported = await core.request("tester", "explorer",
    "importFolder", { handle: root });
  assert.equal(imported.ok, true);
  files = [{ kind: "file", name: "b.txt" }];
  const updated = await core.request("tester", "explorer", "syncExternal");
  assert.equal(updated.ok, true);
  assert.equal(updated.value, true);
  const tree = await core.request("tester", "explorer", "list");
  assert.equal(tree.value[0].children[0].name, "b.txt");
  const paths = await core.request("tester", "explorer", "snapshotRoots");
  assert.deepEqual(paths.value[0].expandedPaths, [""]);
});
