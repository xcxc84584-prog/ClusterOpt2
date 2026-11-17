import test from "node:test";
import assert from "node:assert/strict";
import { runRuntimeAudit } from "../tools/ocda-runtime-audit.mjs";

test("real LinkCore routes REQ/REP, preserves EHU, isolates VTE", async () => {
  const report = await runRuntimeAudit();
  assert.equal(report.pass, true);
  assert.equal(report.tests.length, 8);
  assert.ok(report.tests.every(item => item.pass));
  assert.ok(report.dependencies.some(item => item.code === "10"));
  assert.ok(report.dependencies.some(item => item.code === "01"));
  assert.ok(report.logCounts.ehu >= 7);
  assert.ok(report.tests.some(item => item.status === 423));
  assert.ok(report.tests.some(item => item.status === 409));
});
