import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { SliceRegistry } from "../object/SliceRegistry.js";

function fixture() {
  const core = new LinkCore();
  new SliceRegistry(core);
  core.register({ id: "tester", receive: async () => null,
    authorization: { default: "Public" } });
  return (action, payload = {}) =>
    core.request("tester", "slice-registry", action, payload);
}

test("PR8 virtual descriptor occupies no text memory", async () => {
  const call = fixture();
  const created = await call("registerVirtual", {
    id: "segment-1", start: 0, end: 1024
  });
  assert.equal(created.status, 200);
  assert.equal(created.value.state, "virtual");
  assert.equal(created.value.residentBytes, 0);
  const list = await call("list");
  assert.equal(list.value.entries.length, 1);
  const read = await call("read", { id: "segment-1" });
  assert.equal(read.status, 409);
});

test("PR8 preload is evicted before a full slice on pressure", async () => {
  const call = fixture();
  for (let index = 1; index <= 3; index++) {
    await call("registerVirtual", {
      id: "slice-" + index, start: index * 1024,
      end: (index + 1) * 1024
    });
  }
  await call("setLimit", { bytes: 1024 });
  const loaded = await call("load", {
    id: "slice-1", mode: "full", text: "a".repeat(400)
  });
  assert.equal(loaded.ok, true);
  await call("load", {
    id: "slice-2", mode: "preloaded", text: "b".repeat(400)
  });
  const next = await call("load", {
    id: "slice-3", mode: "full", text: "c".repeat(400)
  });
  assert.equal(next.ok, true);
  const states = (await call("list")).value.entries;
  assert.equal(states.find(x => x.id === "slice-1").state, "full");
  assert.equal(states.find(x => x.id === "slice-2").state, "virtual");
  assert.equal(states.find(x => x.id === "slice-3").state, "full");
});

test("PR8 protects dirty slices and fails without partial eviction", async () => {
  const call = fixture();
  await call("registerVirtual", { id: "dirty", start: 0, end: 1024 });
  await call("registerVirtual", { id: "other", start: 1024, end: 2048 });
  await call("setLimit", { bytes: 1024 });
  await call("load", { id: "dirty", mode: "full",
    text: "d".repeat(800) });
  await call("markDirty", { id: "dirty" });
  const refused = await call("load", { id: "other", mode: "full",
    text: "o".repeat(800) });
  assert.equal(refused.status, 413);
  const states = (await call("list")).value.entries;
  assert.equal(states.find(x => x.id === "dirty").state, "full");
  assert.equal(states.find(x => x.id === "other").state, "virtual");
  assert.equal((await call("demote", { id: "dirty" })).status, 409);
  assert.equal((await call("setLimit", { bytes: null })).ok, true);
  assert.equal((await call("load", {
    id: "other", mode: "preloaded", text: "o".repeat(800)
  })).ok, true);
});
