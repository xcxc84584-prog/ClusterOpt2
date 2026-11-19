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
  assert.deepEqual(production.getSnapshot().objects, ["UICO"]);
  assert.equal(sandbox.delete("B").status, 200);
});

test("Strict object contract rejects missing OCDA components", () => {
  const core = new LinkCore();
  const registered = core.register({
    id: "broken", strictOCDA: true,
    receive: async () => null
  });
  assert.equal(registered, false);
  assert.ok(core.getSnapshot().logs.some(log =>
    log.kind === "EHU" && log.status === 400));
});

test("Registered SubObject inherits parent Property definitions", () => {
  const core = new LinkCore();
  const desc = Object.freeze({
    Request: [], Response: [], UserAPI: [], AgentAPI: [],
    Property: [], Program: "Test", EHU: "LinkCore.OMU",
    Log: "LinkCore.OMU"
  });
  assert.equal(core.register({
    id: "Parent", strictOCDA: true, ocda: desc,
    receive: async () => null
  }), true);
  assert.equal(core.register({
    id: "Parent.Child", parentPath: "Parent",
    strictOCDA: true, ocda: desc,
    receive: async () => null
  }), true);
  core.hub.registerProperty("CommonMethod", () => 123, {
    owners: ["Parent"], visibility: "Protected"
  });
  assert.deepEqual(core.subobjects("Parent"), ["Parent.Child"]);
  assert.ok(core.inheritedProperties("Parent.Child").includes("CommonMethod"));
  assert.equal(core.readProperty("Parent.Child", "CommonMethod").status, 200);
});

test("User and Agent API entrypoints enforce declared action lists", async () => {
  const core = new LinkCore();
  core.register({ id: "ui", receive: async () => null });
  core.register({
    id: "editor",
    ocda: {
      Request: ["save"], Response: ["save"],
      UserAPI: ["save"], AgentAPI: [], Property: [],
      Program: "Editor", EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
    },
    receive: async () => true
  });
  const user = await core.request("ui", "editor", "save", {},
    { origin: "user" });
  const agent = await core.request("ui", "editor", "save", {},
    { origin: "agent" });
  assert.equal(user.status, 200);
  assert.equal(agent.status, 403);
  assert.ok(core.getSnapshot().logs.some(x =>
    x.kind === "EHU" && x.status === 403));
});
