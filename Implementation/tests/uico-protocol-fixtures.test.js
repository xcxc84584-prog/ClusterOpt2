import test from "node:test";
import assert from "node:assert/strict";
import { UIProtocolPolicy } from "../property/UIProtocolPolicy.js";
import { UICOProtocolFixturePolicy } from
  "../property/UICOProtocolFixturePolicy.js";

test("PR23.7 VTE covers every declared UI action and negative envelopes", () => {
  const report = UICOProtocolFixturePolicy.inspect();
  assert.equal(report.ok, true, report.issues.join(", "));
  assert.equal(report.testedActions,
    Object.keys(UIProtocolPolicy.capabilities).length);
  assert.ok(report.testedActions > 10);
  assert.deepEqual(report.issues, []);
  assert.equal(Object.isFrozen(report), true);
});

test("PR23.7 response validator rejects malformed error envelopes", () => {
  const valid = {
    requestId: "fixture", eventId: 4, status: 403, ok: false,
    error: { code: "DENIED", message: "Authorization rejected" }
  };
  assert.equal(UIProtocolPolicy.validateResponse(valid).ok, true);
  assert.equal(UIProtocolPolicy.validateResponse({
    ...valid, ok: true
  }).ok, false);
  assert.equal(UIProtocolPolicy.validateResponse({
    ...valid, error: { ...valid.error, message: 20 }
  }).ok, false);
  assert.equal(UIProtocolPolicy.validateResponse({
    ...valid, unexpected: "field"
  }).ok, false);
});
