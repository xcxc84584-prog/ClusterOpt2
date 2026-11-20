import test from "node:test";
import assert from "node:assert/strict";
import { ObjectManagementUnit } from
  "../LinkCore/ObjectManagementUnit.js";

test("PR24.22 consecutive correlated RPC PASS records each Event ID",
  () => {
    const omu = new ObjectManagementUnit(() => 1000);
    const record = requestId => omu.record("Log",
      "SDK.ExampleEcho", "RPC.HostToPlugin.Response", 200,
      "PluginSandboxBridge", { requestId });
    const first = record("host-1");
    const second = record("host-2");
    const third = record("host-3");
    const fourth = record("host-4");
    assert.deepEqual(
      [first, second, third, fourth].map(item => item.eventId),
      [1, 2, 3, 4]);
    assert.deepEqual(omu.snapshot().logs.map(item =>
      item.details.requestId), [
      "host-4", "host-3", "host-2", "host-1"
    ]);
    assert.equal(omu.nextEventId, 5);
  });

test("PR24.22 uncorrelated repeated PASS remains cooled", () => {
  const omu = new ObjectManagementUnit(() => 1000);
  const first = omu.record("Log", "SDK", "Heartbeat", 200);
  const second = omu.record("Log", "SDK", "Heartbeat", 200);
  const failure = omu.record("EHU", "SDK", "Heartbeat", 403);
  assert.equal(first.eventId, 1);
  assert.equal(second, null);
  assert.equal(failure.eventId, 2);
  assert.equal(omu.snapshot().logs.length, 2);
  assert.equal(omu.nextEventId, 3);
});
