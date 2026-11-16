import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { Explorer } from "../object/Explorer.js";
import { FileTypeManager } from "../object/FileTypeManager.js";

test("PR7 blocklist only hides entries; never removes open tabs", async () => {
  const core = new LinkCore();
  const workspace = new FileWorkspace(core, () => {});
  new Explorer(core);
  new FileTypeManager(core, null);
  core.register({ id: "tester", receive: async () => null,
    authorization: { default: "Public" } });
  workspace.create();
  const before = await core.request("tester", "explorer", "list");
  assert.equal(before.value.length, 1);
  const add = await core.request("tester", "file-types",
    "add", { extension: "TXT" });
  assert.equal(add.ok, true);
  const hidden = await core.request("tester", "explorer", "list");
  assert.equal(hidden.value.length, 0);
  assert.equal(workspace.documents.length, 1);
  const remove = await core.request("tester", "file-types",
    "remove", { extension: ".txt" });
  assert.equal(remove.ok, true);
  const visible = await core.request("tester", "explorer", "list");
  assert.equal(visible.value.length, 1);
});

test("PR7 invalid extension generates EHU 400", async () => {
  const core = new LinkCore();
  new FileWorkspace(core, () => {});
  new FileTypeManager(core, null);
  core.register({ id: "tester", receive: async () => null,
    authorization: { default: "Public" } });
  const result = await core.request("tester", "file-types",
    "add", { extension: "../bad" });
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test("PR8 restored replace preserves extensions on conflict", async () => {
  const core = new LinkCore();
  new FileWorkspace(core, () => {});
  new FileTypeManager(core, null);
  core.register({ id: "tester", receive: async () => null,
    authorization: { default: "Public" } });
  const request = (action, payload) =>
    core.request("tester", "file-types", action, payload);
  assert.equal((await request("add", { extension: ".custom" })).status, 200);
  assert.equal((await request("replace", {
    extension: ".custom", replacement: ".changed"
  })).status, 200);
  assert.equal((await request("replace", {
    extension: ".changed", replacement: ".mp4"
  })).status, 409);
  assert.equal((await request("replace", {
    extension: ".unknown", replacement: ".new"
  })).status, 404);
  const types = (await request("list")).value;
  assert.ok(types.includes(".changed"));
  assert.ok(!types.includes(".custom"));
  assert.ok(core.omu.snapshot().logs.some(item =>
    item.kind === "EHU" && item.status === 409));
});
