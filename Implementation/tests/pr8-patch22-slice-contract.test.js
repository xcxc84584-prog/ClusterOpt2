import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";

test("PR8+22 slice manifest remains explicit for legacy compatibility",
  async () => {
    const core = new LinkCore();
    const workspace = new FileWorkspace(core, () => {});
    core.register({
      id: "tester", receive: async () => null,
      authorization: { default: "Public" }
    });
    const id = workspace.create();
    const result = await core.request("tester", "workspace",
      "sliceManifest", { id }, { origin: "user" });
    assert.equal(result.status, 200);
    assert.equal(result.value.contractVersion, 1);
    assert.equal(result.value.mode, "legacy-compatibility");
    assert.equal(result.value.byteLength, 0);
    assert.equal((await core.request("tester", "workspace",
      "sliceManifest", { id: "missing" })).status, 404);
    assert.ok(core.getSnapshot().dependencies.some(relation =>
      relation.link === "tester->workspace" &&
      relation.code === "10"));
    assert.ok(core.getSnapshot().logs.some(event =>
      event.kind === "EHU" && event.status === 404));
  });

test("PR8+22 manifest validates Unicode and a zero-byte document",
  async () => {
    const core = new LinkCore();
    const workspace = new FileWorkspace(core, () => {});
    core.register({
      id: "tester", receive: async () => null,
      authorization: { default: "Public" }
    });
    const id = workspace.create();
    const call = () => core.request("tester", "workspace",
      "sliceManifest", { id }, { origin: "user" });
    const empty = await call();
    assert.equal(empty.status, 200);
    assert.equal(empty.value.byteLength, 0);
    assert.equal(empty.value.count, 1);
    assert.equal((await core.request("tester", id, "edit", {
      text: "中文😀"
    }, { origin: "user" })).status, 200);
    const unicode = await call();
    assert.equal(unicode.status, 200);
    assert.equal(unicode.value.byteLength,
      new TextEncoder().encode("中文😀").byteLength);
    assert.equal(unicode.value.dirty, true);
  });
