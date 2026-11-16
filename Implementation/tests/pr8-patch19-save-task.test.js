import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { SliceSaveTask } from "../object/SliceSaveTask.js";

test("Patch19 Fix3: task progress is monotonic and bound to document",
  async () => {
    const core = new LinkCore();
    core.register({ id: "ui", receive: async () => null });
    new SliceSaveTask(core);
    const request = (action, payload) => core.request(
      "ui", "slice-save-task", action, payload, { origin: "user" });
    const start = await core.request("ui", "slice-save-task", "begin",
      { id: "docA", revision: 4 });
    assert.equal(start.ok, true);
    await core.request("ui", "slice-save-task", "progress",
      { id: "docA", percent: 44 });
    await core.request("ui", "slice-save-task", "progress",
      { id: "docA", percent: 12 });
    const current = await request("state", { id: "docA" });
    assert.deepEqual(current.value, {
      active: true, percent: 44,
      phase: "writing", revision: 4
    });
    const other = await request("state", { id: "docB" });
    assert.deepEqual(other.value, {
      active: false, percent: 0
    });
    const cancel = await request("cancel", { id: "docA" });
    assert.equal(cancel.value, true);
    assert.equal(start.value.signal.aborted, true);
    assert.equal((await request("state", { id: "docA" }))
      .value.phase, "cancelling");
    assert.equal((await core.request("ui", "slice-save-task",
      "finish", { id: "docA" })).ok, true);
    assert.equal((await request("state", { id: "docA" }))
      .value.active, false);
  });

test("Patch19 Fix3: task rejects overlapping saves and records EHU",
  async () => {
    const core = new LinkCore();
    core.register({ id: "ui", receive: async () => null });
    new SliceSaveTask(core);
    assert.equal((await core.request("ui", "slice-save-task",
      "begin", { id: "same", revision: 1 })).ok, true);
    const duplicate = await core.request("ui", "slice-save-task",
      "begin", { id: "same", revision: 1 });
    assert.equal(duplicate.status, 409);
    assert.ok(core.getSnapshot().logs.some(entry =>
      entry.kind === "EHU" && entry.status === 409 &&
      entry.source === "slice-save-task"));
  });
