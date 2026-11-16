import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";

test("PR5 policy is a single registered public property", () => {
  const core = new LinkCore();
  const workspace = new FileWorkspace(core, () => {});
  const value = core.readProperty(workspace.id, "EditorInteractionPolicy");
  assert.equal(value.ok, true);
  assert.equal(value.value.transform("", 0, 0, "(").insert, "()");
  const registered = core.getSnapshot().properties.filter(item =>
    item.name === "EditorInteractionPolicy");
  assert.equal(registered.length, 1);
});

test("PR5 edited text follows HubUnit Req/Rep and OMU PASS/FAIL", async () => {
  const core = new LinkCore();
  const workspace = new FileWorkspace(core, () => {});
  const docId = workspace.create();
  const pass = await core.request(workspace.id, docId, "edit", {
    text: "typed()"
  }, { origin: "user" });
  assert.equal(pass.status, 200);
  assert.equal(workspace.active.text, "typed()");
  const fail = await core.request(workspace.id, docId, "edit", {
    text: 42
  }, { origin: "user" });
  assert.equal(fail.ok, false);
  assert.equal(fail.status, 500);
  const snapshot = core.getSnapshot();
  assert.ok(snapshot.logs.some(log =>
    log.action === "Response.edit" && log.status === 200));
  assert.ok(snapshot.logs.some(log =>
    log.kind === "EHU" && log.action === "Response.edit"));
  assert.ok(snapshot.dependencies.some(item =>
    item.link === workspace.id + "->" + docId));
});
