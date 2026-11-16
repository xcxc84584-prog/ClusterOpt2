import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { SliceRegistry } from "../object/SliceRegistry.js";
import { SliceLoader } from "../object/SliceLoader.js";

function fixture() {
  const core = new LinkCore();
  new SliceRegistry(core, null);
  new SliceLoader(core);
  core.register({ id: "tester", receive: async () => null,
    authorization: { default: "Public" } });
  return {
    core,
    call: (target, action, payload = {}) =>
      core.request("tester", target, action, payload)
  };
}

test("PR8 Patch7 reads UTF-8 aligned byte slices on demand", async () => {
  const { call } = fixture();
  const expected = "a".repeat(1023) + "😀界" + "b".repeat(1400);
  const blob = new Blob([expected]);
  const opened = await call("slice-loader", "open", {
    id: "unicode", blob, chunkBytes: 1024
  });
  assert.equal(opened.status, 200);
  assert.equal(opened.value.count, 3);
  const pieces = [];
  for (let index = 0; index < opened.value.count; index++) {
    const loaded = await call("slice-loader", "load", {
      id: "unicode", index, mode: "full"
    });
    assert.equal(loaded.status, 200);
    const read = await call("slice-registry", "read", {
      id: loaded.value.id
    });
    assert.equal(read.status, 200);
    pieces.push(read.value);
  }
  assert.equal(pieces.join(""), expected);
  assert.equal((await call("slice-loader", "describe", {
    id: "unicode"
  })).value.byteLength, blob.size);
});

test("PR8 Patch7 virtual open does not read Blob bytes", async () => {
  const { call } = fixture();
  let calls = 0;
  class TrackedBlob extends Blob {
    slice(start, end) {
      calls++;
      return super.slice(start, end);
    }
  }
  const blob = new TrackedBlob(["x".repeat(3000)]);
  await call("slice-loader", "open", {
    id: "tracked", blob, chunkBytes: 1024
  });
  assert.equal(calls, 0);
  const loaded = await call("slice-loader", "load", {
    id: "tracked", index: 2, mode: "preloaded"
  });
  assert.equal(loaded.status, 200);
  assert.ok(calls > 0);
  assert.equal((await call("slice-registry", "read", {
    id: loaded.value.id
  })).status, 409);
});

test("PR8 Patch7 failures produce EHU and preserve registration", async () => {
  const { core, call } = fixture();
  const opened = await call("slice-loader", "open", {
    id: "bad", blob: new Blob([new Uint8Array([0xff, 0xfe])]),
    chunkBytes: 1024
  });
  assert.equal(opened.status, 200);
  assert.equal((await call("slice-loader", "load", {
    id: "bad", index: 0, mode: "full"
  })).status, 422);
  assert.equal((await call("slice-loader", "load", {
    id: "bad", index: 7, mode: "full"
  })).status, 400);
  assert.equal((await call("slice-loader", "open", {
    id: "bad", blob: new Blob([])
  })).status, 409);
  assert.ok(core.omu.snapshot().logs.some(entry =>
    entry.type === "EHU" || entry.kind === "EHU"));
});
