import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { AccessPolicy } from "../property/AccessPolicy.js";
import { VirtualTestEnvironment } from "../LinkCore/VirtualTestEnvironment.js";

test("Private endpoint denies other objects and logs EHU", async () => {
  const core = new LinkCore();
  core.register({ id: "ui", receive: async () => null });
  core.register({
    id: "private", authorization: { edit: "Private" },
    receive: async () => "secret"
  });
  const result = await core.request("ui", "private", "edit");
  assert.equal(result.status, 403);
  assert.ok(core.getSnapshot().logs.some(x =>
    x.kind === "EHU" && x.status === 403));
});

test("Protected permits descendants but denies unrelated objects", async () => {
  assert.equal(AccessPolicy.canInvoke("Panel.Child", "Panel", "Protected"), true);
  assert.equal(AccessPolicy.canInvoke("Other", "Panel", "Protected"), false);
  assert.equal(AccessPolicy.canInvoke("Panel2", "Panel", "Protected"), false);
});

test("VTE is isolated from production registry", async () => {
  const production = new LinkCore();
  const sandbox = new VirtualTestEnvironment();
  assert.equal(sandbox.create("A").status, 201);
  assert.equal(sandbox.create("B").status, 201);
  const result = await sandbox.act("A", "B", "echo", { value: 12 });
  assert.equal(result.status, 200);
  assert.deepEqual(result.value, { value: 12 });
  assert.equal(production.getSnapshot().objects.length, 0);
  assert.equal(sandbox.delete("B").status, 200);
});
