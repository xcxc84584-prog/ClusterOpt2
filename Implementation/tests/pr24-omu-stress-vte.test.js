import test from "node:test";
import assert from "node:assert/strict";
import { ObjectManagementUnit } from
  "../LinkCore/ObjectManagementUnit.js";

/**
 * PR24.39: high-volume correlated audit and dependency stress.
 * All iterations use independent request IDs. The OMU is bounded in
 * memory, so retained log count is not equivalent to recorded events.
 */
test("PR24.39 12k correlated outcomes retain unique Event IDs", () => {
  let now = Date.parse("2026-11-20T00:00:00.000Z");
  const limit = 2000;
  const omu = new ObjectManagementUnit(() => now, limit);
  const seen = new Set();
  const providers = 12;
  const callsPerProvider = 1000;

  for (let i = 0; i < providers * callsPerProvider; i++) {
    const source = "Plugin.P" + (i % providers);
    const target = "Service.S" + (i % 7);
    const status = i % 11 === 0 ? 503 : 200;
    const requestId = "load-" + i;
    const event = omu.record(status === 200 ? "Log" : "EHU",
      source, "RPC.Response", status, target, { requestId });
    assert.ok(event, "correlated events must not be cooled");
    assert.ok(!seen.has(event.eventId), "Event ID collision");
    seen.add(event.eventId);
    omu.dependency(source, target, "request");
    omu.dependency(source, target, "response");
  }

  assert.equal(seen.size, providers * callsPerProvider);
  assert.equal(omu.nextEventId, providers * callsPerProvider + 1);
  const snapshot = omu.snapshot();
  assert.equal(snapshot.logs.length, limit);
  assert.equal(new Set(snapshot.logs.map(row => row.eventId)).size,
    limit);
  assert.equal(snapshot.logs[0].details.requestId, "load-11999");
  assert.equal(snapshot.logs.at(-1).details.requestId, "load-10000");
  assert.equal(snapshot.dependencies.length, providers * 7);
  assert.ok(snapshot.dependencies.every(item => item.code === "11"));

  now += 100;
  const failure = omu.record("EHU", "Plugin.P0", "RPC.Response",
    403, "Service.S0", { requestId: "denied-final" });
  assert.equal(failure.eventId, 12001);
});

test("PR24.39 one-second cooling never suppresses correlated FAIL",
  () => {
    let now = 1000;
    const omu = new ObjectManagementUnit(() => now, 32);
    const first = omu.record("Log", "Plugin.A", "Heartbeat", 200);
    assert.equal(first.eventId, 1);
    assert.equal(omu.record("Log", "Plugin.A", "Heartbeat", 200),
      null);

    for (let i = 0; i < 30; i++) {
      const row = omu.record("EHU", "Plugin.A",
        "RPC.Rejected", 403, "HubUnit", { requestId: "fail-" + i });
      assert.equal(row.eventId, i + 2);
    }

    const correlatedSuccess = omu.record("Log", "Plugin.A",
      "Heartbeat", 200, "", { requestId: "success" });
    assert.equal(correlatedSuccess.eventId, 32);
    assert.equal(omu.record("Log", "Plugin.A", "Heartbeat", 200),
      null);
    now += 1001;
    assert.equal(omu.record("Log", "Plugin.A", "Heartbeat", 200)
      .eventId, 33);
    assert.equal(omu.snapshot().logs.length, 32);
  });
