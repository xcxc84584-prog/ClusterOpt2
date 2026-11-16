import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { PieceTreeIndex } from "../object/PieceTreeIndex.js";

function fixture() {
  const core = new LinkCore();
  new PieceTreeIndex(core);
  core.register({ id: "tester", receive: async () => null,
    authorization: { default: "Public" } });
  return (action, payload = {}) =>
    core.request("tester", "piece-tree-index", action, payload);
}

test("PR8 Patch6: insert, split, remove and seek through Hub", async () => {
  const call = fixture();
  assert.equal((await call("insert", {
    offset: 0, text: "alpha beta"
  })).status, 200);
  assert.equal((await call("insert", {
    offset: 5, text: "++"
  })).status, 200);
  assert.equal((await call("read", {
    start: 0, end: 12
  })).value, "alpha++ beta");
  assert.equal((await call("locate", { offset: 6 })).status, 200);
  assert.equal((await call("remove", {
    start: 5, end: 7
  })).status, 200);
  assert.equal((await call("read", {
    start: 0, end: 10
  })).value, "alpha beta");
  assert.equal((await call("info")).value.revision, 3);
});

test("PR8 Patch6: stale revision and invalid offsets are rejected", async () => {
  const call = fixture();
  await call("insert", { offset: 0, text: "abc" });
  assert.equal((await call("insert", {
    offset: 1, text: "x", revision: 0
  })).status, 409);
  assert.equal((await call("remove", {
    start: 0, end: 20
  })).status, 400);
  assert.equal((await call("locate", { offset: 3 })).status, 400);
  assert.equal((await call("read", {
    start: 0, end: 3
  })).value, "abc");
});

test("PR8 Patch6: edits agree with a reference text model", async () => {
  const call = fixture();
  let expected = "";
  for (let i = 0; i < 100; i++) {
    const offset = expected.length ? (i * 13) % (expected.length + 1) : 0;
    const text = String.fromCharCode(65 + i % 26);
    const result = await call("insert", { offset, text });
    assert.equal(result.status, 200);
    expected = expected.slice(0, offset) + text +
      expected.slice(offset);
  }
  for (let i = 0; i < 30; i++) {
    const start = (i * 7) % expected.length;
    const result = await call("remove", { start, end: start + 1 });
    assert.equal(result.status, 200);
    expected = expected.slice(0, start) + expected.slice(start + 1);
  }
  const result = await call("read", {
    start: 0, end: expected.length
  });
  assert.equal(result.value, expected);
  for (let i = 0; i < expected.length; i++) {
    const location = await call("locate", { offset: i });
    assert.equal(location.status, 200);
    assert.ok(location.value.start <= i);
    assert.ok(location.value.end > i);
  }
});
