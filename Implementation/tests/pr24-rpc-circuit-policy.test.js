import test from "node:test";
import assert from "node:assert/strict";
import { PluginRPCCircuitPolicy as Circuit } from
  "../property/PluginRPCCircuitPolicy.js";

test("PR24.82 timeout policy trips at three and discards stale events",
  () => {
    const one = Circuit.recordTimeout([], 1000);
    const two = Circuit.recordTimeout(one.timestamps, 1100);
    const three = Circuit.recordTimeout(two.timestamps, 1200);
    assert.equal(one.open, false);
    assert.equal(two.open, false);
    assert.equal(three.open, true);
    assert.deepEqual(three.timestamps, [1000, 1100, 1200]);
    assert.equal(Object.isFrozen(three.timestamps), true);
    const expired = Circuit.recordTimeout(three.timestamps,
      1200 + Circuit.windowMs + 1);
    assert.equal(expired.open, false);
    assert.deepEqual(expired.timestamps, [
      1200 + Circuit.windowMs + 1
    ]);
    assert.equal(Circuit.recordTimeout(null, 1000).status, 400);
    assert.equal(Circuit.recordTimeout([], NaN).status, 400);
  });
