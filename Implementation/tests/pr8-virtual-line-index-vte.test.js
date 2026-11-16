import test from "node:test";
import assert from "node:assert/strict";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";
import { SliceLoader } from "../object/SliceLoader.js";
import { SliceRegistry } from "../object/SliceRegistry.js";
import { VirtualLineIndex } from "../object/VirtualLineIndex.js";
import { ViewportSliceController } from
  "../object/ViewportSliceController.js";

function fixture() {
  const vte = new VirtualTestEnvironment();
  vte.create("actor");
  new SliceRegistry(vte.core, null);
  new SliceLoader(vte.core);
  new VirtualLineIndex(vte.core);
  new ViewportSliceController(vte.core);
  const request = (target, action, payload = {}) =>
    vte.core.request("VTE.actor", target, action, payload);
  return { vte, request };
}

test("Patch12 UTF-8 line addresses are exact without whole-file read",
  async () => {
    const { vte, request } = fixture();
    const text = "甲\r\nβ\n😀😀\r\nlast";
    let slices = 0;
    class TrackedBlob extends Blob {
      slice(start, end) {
        slices++;
        assert.ok(end - start <= 64 * 1024);
        return super.slice(start, end);
      }
    }
    const blob = new TrackedBlob([text]);
    const opened = await request("virtual-line-index", "open", {
      id: "unicode", blob
    });
    assert.equal(opened.status, 200);
    assert.equal(slices, 0);
    const parts = ["甲\r\n", "β\n", "😀😀\r\n", "last"];
    let offset = 0;
    for (let line = 1; line <= parts.length; line++) {
      const located = await request("virtual-line-index", "locate", {
        id: "unicode", line
      });
      assert.equal(located.status, 200);
      assert.equal(located.value.byteOffset, offset);
      offset += new TextEncoder().encode(parts[line - 1]).length;
    }
    const range = await request("virtual-line-index", "range", {
      id: "unicode", firstLine: 2, lastLine: 3
    });
    assert.equal(range.status, 200);
    assert.equal(range.value.start,
      new TextEncoder().encode(parts[0]).length);
    assert.equal(range.value.end, offset -
      new TextEncoder().encode(parts[3]).length);
    const invalid = await request("virtual-line-index", "locate", {
      id: "unicode", line: 99
    });
    assert.equal(invalid.status, 416);
    assert.ok(vte.log().some(item => item.kind === "EHU" &&
      item.status === 416));
    const metadata = (await request("virtual-line-index", "describe", {
      id: "unicode"
    })).value;
    assert.equal(metadata.totalLines, 4);
    const deps = vte.snapshot().dependencies;
    assert.ok(deps.some(item =>
      item.link === "VTE.actor->virtual-line-index" &&
      item.code === "10"));
    assert.ok(deps.some(item =>
      item.link === "virtual-line-index->VTE.actor" &&
      item.code === "01"));
  });

test("Patch12 checkpoints support backward seek after large jump",
  async () => {
    const { request } = fixture();
    const blob = new Blob(["x\n".repeat(9000) + "final"]);
    assert.equal((await request("virtual-line-index", "open", {
      id: "many", blob
    })).status, 200);
    assert.equal((await request("virtual-line-index", "locate", {
      id: "many", line: 8501
    })).value.byteOffset, 17000);
    const meta = (await request("virtual-line-index", "describe", {
      id: "many"
    })).value;
    assert.ok(meta.checkpointCount >= 3);
    assert.equal((await request("virtual-line-index", "locate", {
      id: "many", line: 100
    })).value.byteOffset, 198);
    assert.equal((await request("virtual-line-index", "locate", {
      id: "many", line: 9001
    })).value.byteOffset, 18000);
    assert.equal((await request("virtual-line-index", "range", {
      id: "many", firstLine: 9001, lastLine: 9001
    })).value.end, blob.size);
    assert.equal((await request("virtual-line-index", "range", {
      id: "many", firstLine: 9002, lastLine: 9002
    })).status, 416);
  });

test("Patch12 line-to-byte to slice EventChain and EOF handling",
  async () => {
    const { vte, request } = fixture();
    const text = "a\n".repeat(1024) + "終";
    const opened = await request("viewport-slices", "open", {
      id: "lines", blob: new Blob([text]), chunkBytes: 1024
    });
    assert.equal(opened.status, 200);
    const jump = await request("viewport-slices", "navigateLines", {
      id: "lines", firstLine: 700, lastLine: 705, adjacent: 0
    });
    assert.equal(jump.status, 200);
    assert.deepEqual(jump.value.full, [1]);
    const byteJump = await request("viewport-slices", "navigateBytes", {
      id: "lines", start: 1023, end: 1025, adjacent: 0
    });
    assert.equal(byteJump.status, 200);
    assert.deepEqual(byteJump.value.full, [0, 1]);
    const invalid = await request("viewport-slices", "navigateLines", {
      id: "lines", firstLine: 0, lastLine: 1
    });
    assert.equal(invalid.status, 400);
    const empty = await request("viewport-slices", "open", {
      id: "empty", blob: new Blob([]), chunkBytes: 1024
    });
    assert.equal(empty.status, 200);
    const eof = await request("viewport-slices", "navigateLines", {
      id: "empty", firstLine: 1, lastLine: 1
    });
    assert.equal(eof.status, 200);
    assert.deepEqual(eof.value.full, []);
    assert.ok(vte.snapshot().dependencies.some(item =>
      item.link === "viewport-slices->virtual-line-index" &&
      item.code === "10"));
  });

test("Patch12 rejects invalid line indices and duplicates with EHU",
  async () => {
    const { vte, request } = fixture();
    assert.equal((await request("virtual-line-index", "open", {
      id: "!?", blob: new Blob(["x"])
    })).status, 400);
    assert.equal((await request("virtual-line-index", "open", {
      id: "dupe", blob: new Blob(["x"])
    })).status, 200);
    assert.equal((await request("virtual-line-index", "open", {
      id: "dupe", blob: new Blob(["x"])
    })).status, 409);
    assert.equal((await request("virtual-line-index", "range", {
      id: "dupe", firstLine: 2, lastLine: 1
    })).status, 400);
    assert.equal((await request("virtual-line-index", "range", {
      id: "dupe", firstLine: Number.MAX_SAFE_INTEGER,
      lastLine: Number.MAX_SAFE_INTEGER
    })).status, 400);
    assert.equal((await request("virtual-line-index", "locate", {
      id: "unknown", line: 1
    })).status, 404);
    for (const status of [400, 404, 409]) {
      assert.ok(vte.log().some(item => item.kind === "EHU" &&
        item.status === status));
    }
  });

test("Patch12 clean close releases all slices and reusable Blob id",
  async () => {
    const { vte, request } = fixture();
    const blob = new Blob(["a".repeat(3500)]);
    assert.equal((await request("viewport-slices", "open", {
      id: "closing", blob, chunkBytes: 1024
    })).status, 200);
    assert.equal((await request("viewport-slices", "navigate", {
      id: "closing", first: 0, last: 1, adjacent: 1
    })).status, 200);
    const before = (await request("slice-registry", "list")).value;
    assert.ok(before.entries.some(item =>
      item.id.startsWith("closing-slice-")));
    const closed = await request("viewport-slices", "close", {
      id: "closing"
    });
    assert.equal(closed.status, 200);
    const after = (await request("slice-registry", "list")).value;
    assert.ok(!after.entries.some(item =>
      item.id.startsWith("closing-slice-")));
    assert.equal((await request("virtual-line-index", "describe", {
      id: "closing"
    })).status, 404);
    assert.equal((await request("slice-loader", "describe", {
      id: "closing"
    })).status, 404);
    assert.equal((await request("viewport-slices", "navigate", {
      id: "closing", first: 0, last: 0
    })).status, 404);
    assert.equal((await request("viewport-slices", "open", {
      id: "closing", blob, chunkBytes: 1024
    })).status, 200);
    const deps = vte.snapshot().dependencies;
    assert.ok(deps.some(item =>
      item.link === "viewport-slices->slice-loader" &&
      item.code === "10"));
    assert.ok(deps.some(item =>
      item.link === "slice-loader->slice-registry" &&
      item.code === "10"));
  });

test("Patch12 dirty virtual close fails without losing any edits",
  async () => {
    const { vte, request } = fixture();
    await request("viewport-slices", "open", {
      id: "dirtydoc", blob: new Blob(["a".repeat(2048)]),
      chunkBytes: 1024
    });
    await request("viewport-slices", "navigate", {
      id: "dirtydoc", first: 0, last: 0, adjacent: 0
    });
    assert.equal((await request("slice-registry", "markDirty", {
      id: "dirtydoc-slice-0"
    })).status, 200);
    assert.equal((await request("viewport-slices", "close", {
      id: "dirtydoc"
    })).status, 409);
    assert.equal((await request("slice-loader", "describe", {
      id: "dirtydoc"
    })).status, 200);
    assert.equal((await request("virtual-line-index", "describe", {
      id: "dirtydoc"
    })).status, 200);
    const kept = (await request("slice-registry", "list")).value.entries
      .find(item => item.id === "dirtydoc-slice-0");
    assert.equal(kept.state, "full");
    assert.equal(kept.dirty, true);
    assert.equal((await request("slice-registry", "release", {
      id: "dirtydoc-slice-0"
    })).status, 409);
    assert.ok(vte.log().some(item =>
      item.kind === "EHU" && item.status === 409));
  });
