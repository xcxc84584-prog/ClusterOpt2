import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { Explorer } from "../object/Explorer.js";

function fixture() {
  const core = new LinkCore();
  new FileWorkspace(core, () => {});
  new Explorer(core);
  core.register({ id: "test-client", receive: async () => null,
    authorization: { default: "Public" } });
  return core;
}

test("PR6 directory imports and expands through HubUnit", async () => {
  const core = fixture();
  const nested = { kind: "directory", name: "src",
    async *values() { yield { kind: "file", name: "main.js" }; } };
  const root = { kind: "directory", name: "project",
    async *values() {
      yield nested;
      yield { kind: "file", name: "README.md" };
    } };
  const imported = await core.request("test-client", "explorer",
    "importFolder", { handle: root });
  assert.equal(imported.ok, true);
  let listed = await core.request("test-client", "explorer", "list");
  assert.equal(listed.value.length, 1);
  assert.equal(listed.value[0].children.length, 2);
  const childId = listed.value[0].children[0].id;
  const expanded = await core.request("test-client", "explorer",
    "expand", { id: childId });
  assert.equal(expanded.ok, true);
  listed = await core.request("test-client", "explorer", "list");
  assert.equal(listed.value[0].children[0].children[0].name, "main.js");
  const collapsed = await core.request("test-client", "explorer",
    "refreshTree");
  assert.equal(collapsed.ok, true);
  listed = await core.request("test-client", "explorer", "list");
  assert.equal(listed.value[0].expanded, false);
});

test("PR6 invalid handle fails with EHU", async () => {
  const core = fixture();
  const result = await core.request("test-client", "explorer",
    "importFolder", { handle: { kind: "file" } });
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.ok(core.getSnapshot().logs.some(item =>
    item.kind === "EHU" && item.status === 400));
});
