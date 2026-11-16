import test from "node:test";
import assert from "node:assert/strict";
import { EditorViewportPolicy as policy } from
  "../property/EditorViewportPolicy.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

test("PR8 guide geometry is scroll- and font-size-aware", () => {
  const near = policy.guidePosition({
    scrollTop: 43, scrollLeft: 25, lineHeight: 20,
    paddingTop: 18, paddingLeft: 16
  });
  assert.deepEqual(near, { top: 15, paddingLeft: -9 });
  assert.equal(policy.guidePosition({
    scrollTop: 200, scrollLeft: 0, lineHeight: 25,
    paddingTop: 12, paddingLeft: 9
  }).top, 12);
});

test("PR8 progress status and bounds track current operation", () => {
  for (const status of ["green", "yellow", "red", "blue"]) {
    assert.equal(policy.progress(status, 120).status, status);
  }
  assert.deepEqual(policy.progress("blue", 34), {
    status: "blue", percent: 34, label: true
  });
  assert.equal(policy.progress("yellow", -10).percent, 0);
  assert.equal(policy.progress("invalid", Number.NaN).status, "red");
});

test("PR6/PR7 OCDA VTE simulated Req/Rep, EHU and relation 11", async () => {
  const vte = new VirtualTestEnvironment();
  assert.equal(vte.create("sender").status, 201);
  assert.equal(vte.create("receiver").status, 201);
  const pass = await vte.act("sender", "receiver",
    "list", { probe: "Explorer" });
  assert.equal(pass.status, 200);
  assert.deepEqual(pass.value, { probe: "Explorer" });
  assert.ok(vte.snapshot().dependencies.some(relation =>
    relation.link === "VTE.sender->VTE.receiver" &&
    relation.code === "10"));
  assert.ok(vte.snapshot().dependencies.some(relation =>
    relation.link === "VTE.receiver->VTE.sender" &&
    relation.code === "01"));
  const missing = await vte.act("sender", "missing", "list");
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);
  assert.ok(vte.log().some(entry =>
    entry.kind === "EHU" && entry.status === 404));
  assert.equal(vte.delete("receiver").status, 200);
});
