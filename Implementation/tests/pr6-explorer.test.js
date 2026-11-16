import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { Explorer } from "../object/Explorer.js";

function setup() {
  const core = new LinkCore();
  const workspace = new FileWorkspace(core, () => {});
  const explorer = new Explorer(core);
  core.register({
    id: "test-ui",
    receive: async () => null,
    authorization: { default: "Public" }
  });
  return { core, workspace, explorer };
}

test("PR6 Explorer lists and searches through HubUnit", async () => {
  const { core, workspace } = setup();
  workspace.create();
  workspace.active.name = "Hello.cpp";
  workspace.create();
  workspace.active.name = "notes.md";
  const result = await core.request("test-ui", "explorer", "list", {
    query: "HELLO"
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.map(entry => entry.name), ["Hello.cpp"]);
  assert.equal(core.getSnapshot().dependencies.length > 0, true);
});

test("PR6 Explorer activates existing tabs without duplicate file", async () => {
  const { core, workspace } = setup();
  const first = workspace.create();
  workspace.create();
  const result = await core.request("test-ui", "explorer", "activate", {
    id: first
  });
  assert.equal(result.ok, true);
  assert.equal(workspace.activeId, first);
  assert.equal(workspace.documents.length, 2);
});

test("PR6 Explorer invalid action returns EHU without mutation", async () => {
  const { core, workspace } = setup();
  workspace.create();
  const result = await core.request("test-ui", "explorer", "invalid");
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(workspace.documents.length, 1);
});
