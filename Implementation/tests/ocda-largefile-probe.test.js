import test from "node:test";
import assert from "node:assert/strict";
import { runSparseProbe } from "../tools/ocda-largefile-probe.mjs";

test("real sparse 1/64/1024/5120 MiB files have bounded slice reads",
  async () => {
    const result = await runSparseProbe();
    assert.equal(result.pass, true);
    assert.deepEqual(result.cases.map(item => item.sizeMiB),
      [1, 64, 1024, 5120]);
    assert.ok(result.cases.every(item =>
      item.inspectedBytes <= 3 * 65536));
    assert.equal(result.cases.at(-1).logicalBytes,
      5 * 1024 ** 3);
    assert.ok(result.cases.at(-1).lastByteOffset > 2 ** 32);
  });
