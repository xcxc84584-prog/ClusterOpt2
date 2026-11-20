import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { ObjectManagementUnit } from "../LinkCore/ObjectManagementUnit.js";
import { objectPath } from "../LinkCore/ObjectContract.js";

test("LinkCore registers objects and mediates Request/Response", async () => {
  const core = new LinkCore();
  assert.equal(core.register({
    id: "Sender", receive: async () => null
  }), true);
  assert.equal(core.register({
    id: "Receiver", receive: async (action, payload) =>
      action === "echo" ? payload.text : null
  }), true);
  const result = await core.request("Sender", "Receiver", "echo",
    { text: "hello" });
  assert.equal(result.status, 200);
  assert.equal(result.value, "hello");
  assert.deepEqual(core.getSnapshot().dependencies, [
    { link: "Sender->Receiver", code: "10" },
    { link: "Receiver->Sender", code: "01" }
  ]);
});

test("Unregistered sender and receiver generate EHU", async () => {
  const core = new LinkCore();
  const badSender = await core.request("missing", "missing", "edit");
  assert.equal(badSender.status, 404);
  core.register({ id: "A", receive: async () => null });
  const badReceiver = await core.request("A", "missing", "edit");
  assert.equal(badReceiver.status, 404);
  assert.equal(core.getSnapshot().logs.filter(x => x.kind === "EHU").length, 2);
});

test("Registration rejects conflicting identifiers", () => {
  const core = new LinkCore();
  assert.equal(core.register({ id: "A", receive: async () => 1 }), true);
  assert.equal(core.register({ id: "A", receive: async () => 2 }), false);
  assert.equal(core.getSnapshot().logs[0].status, 409);
});

test("OMU cools ordinary pass for one second, never failure/EHU", () => {
  let now = 1000;
  const omu = new ObjectManagementUnit(() => now);
  omu.record("Log", "A", "test", 200, "B");
  omu.record("Log", "A", "test", 200, "B");
  omu.record("Log", "A", "test", 500, "B");
  omu.record("EHU", "A", "test", 500, "B");
  assert.equal(omu.logs.length, 3);
  now += 1001;
  omu.record("Log", "A", "test", 200, "B");
  assert.equal(omu.logs.length, 4);
});

test("Global property updates are shared", () => {
  const core = new LinkCore();
  // PR2 registers UI_COLOR globally at LinkCore startup.
  assert.deepEqual(core.edpmu.get("UI_COLOR"), [0, 0, 0]);
  assert.equal(core.hub.publishProperty("UI_COLOR", [17, 17, 17]).status, 200);
  assert.deepEqual(core.edpmu.get("UI_COLOR"), [17, 17, 17]);
});

test("SubObject addresses use explicit full paths", () => {
  assert.equal(objectPath("FileWorkspace", "Tab"), "FileWorkspace.Tab");
});

test("Registries are isolated and ephemeral across instances", () => {
  const first = new LinkCore();
  first.register({ id: "A", receive: async () => null });
  const second = new LinkCore();
  assert.deepEqual(second.getSnapshot().objects, ["UICO"]);
  assert.equal(second.getSnapshot().objects.includes("A"), false);
});
