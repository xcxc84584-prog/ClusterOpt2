import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { SliceEditTransaction } from "../object/SliceEditTransaction.js";

function setup() {
  const core = new LinkCore();
  // A real OCDA sender must exist before HubUnit accepts user requests.
  if (!core.register({ id: "ui", receive: async () => true })) {
    throw new Error("Test UI registration failed");
  }
  new SliceEditTransaction(core);
  const act = (action, payload = {}) =>
    core.request("ui", "slice-edit-transaction",
      action, payload, { origin: "user" });
  return { core, act };
}

test("Patch15 atomic insert/remove/replace with MVCC", async () => {
  const { act } = setup();
  assert.equal((await act("open", { id: "slice-a", text: "hello" })).ok,
    true);
  const edit = await act("transact", {
    id: "slice-a", revision: 0,
    operations: [
      { type: "replace", start: 0, end: 1, text: "H" },
      { type: "insert", start: 5, text: "!" }
    ]
  });
  assert.equal(edit.ok, true, edit.error);
  assert.equal(edit.value.revision, 1);
  assert.equal(edit.value.dirty, true);
  const result = await act("read", {
    id: "slice-a", start: 0, end: 6
  });
  assert.equal(result.value, "Hello!");
  assert.equal((await act("close", { id: "slice-a" })).status, 409);
});

test("Patch15 invalid batch rolls back the entire edit", async () => {
  const { act } = setup();
  await act("open", { id: "slice-b", text: "abc" });
  const failure = await act("transact", {
    id: "slice-b", revision: 0,
    operations: [
      { type: "insert", start: 1, text: "X" },
      { type: "remove", start: 99, end: 100 }
    ]
  });
  assert.equal(failure.status, 400);
  assert.equal((await act("info", { id: "slice-b" })).value.revision, 0);
  assert.equal((await act("read", {
    id: "slice-b", start: 0, end: 3
  })).value, "abc");
  assert.equal((await act("close", { id: "slice-b" })).ok, true);
});

test("Patch15 stale revision conflicts and independent slice isolation",
  async () => {
    const { act } = setup();
    await act("open", { id: "slice-1", text: "foo" });
    await act("open", { id: "slice-2", text: "bar" });
    const apply = id => act("transact", {
      id, revision: 0, operations: [
        { type: "insert", start: 3, text: "!" }
      ]
    });
    assert.equal((await apply("slice-1")).ok, true);
    assert.equal((await apply("slice-2")).ok, true);
    assert.equal((await apply("slice-1")).status, 409);
    assert.equal((await act("read", {
      id: "slice-2", start: 0, end: 4
    })).value, "bar!");
  });

test("Patch15 UTF-16 offsets, B+ seek and bounded input", async () => {
  const { act } = setup();
  assert.equal((await act("open", {
    id: "unicode", text: "A😀B"
  })).ok, true);
  const seek = await act("locate", { id: "unicode", offset: 1 });
  assert.equal(seek.ok, true, seek.error);
  assert.equal(seek.value.localOffset, 1);
  const replace = await act("transact", {
    id: "unicode", revision: 0, operations: [{
      type: "replace", start: 1, end: 3, text: "中"
    }]
  });
  assert.equal(replace.ok, true, replace.error);
  assert.equal((await act("read", {
    id: "unicode", start: 0, end: 3
  })).value, "A中B");
  const oversized = await act("transact", {
    id: "unicode", revision: 1, operations: [{
      type: "insert", start: 3, text: "x".repeat(1024 * 1024)
    }]
  });
  assert.equal(oversized.status, 413);
  assert.equal((await act("info", {
    id: "unicode"
  })).value.revision, 1);
});

test("Patch15 concurrent edits with same revision yield one conflict",
  async () => {
    const { act } = setup();
    await act("open", { id: "race", text: "a" });
    const payload = { id: "race", revision: 0, operations: [{
      type: "insert", start: 1, text: "b"
    }] };
    const results = await Promise.all([
      act("transact", payload), act("transact", payload)
    ]);
    assert.deepEqual(results.map(item => item.status).sort(),
      [200, 409]);
    assert.equal((await act("read", {
      id: "race", start: 0, end: 2
    })).value, "ab");
  });
