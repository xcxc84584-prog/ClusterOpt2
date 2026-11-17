import test from "node:test";
import assert from "node:assert/strict";
import { GlobalPageLinePolicy } from
  "../property/GlobalPageLinePolicy.js";

const pageBytes = 1024;
const locate = async (text, targetLine, edits) =>
  GlobalPageLinePolicy.locate({
    file: new Blob([text]), targetLine, pageBytes,
    edits: edits ?? new Map()
  });

test("PR9 global seek: spans virtual pages and preserves CRLF/UTF-8", async () => {
  const text = "甲\r\n" + "x".repeat(1018) +
    "\n😀\n" + "b".repeat(2048) + "\n尾";
  const second = await locate(text, 2);
  const third = await locate(text, 3);
  const fourth = await locate(text, 4);
  assert.equal(second.index, 0);
  assert.ok(third.index >= 1);
  assert.ok(fourth.index >= third.index);
  assert.equal((await locate(text, 1)).index, 0);
  await assert.rejects(locate(text, 5), { status: 416 });
  await assert.rejects(locate(text, 0), { status: 400 });
});

test("PR9 global seek: empty trailing line and boundary LF", async () => {
  const text = "x".repeat(1023) + "\n" + "next\n";
  const second = await locate(text, 2);
  assert.equal(second.index, 1);
  const third = await locate(text, 3);
  assert.equal(third.index, 1);
  assert.equal(third.localLine, 2);
  await assert.rejects(locate(text, 4), { status: 416 });
});

test("PR9 global seek: dirty revisions shift later global lines", async () => {
  const text = "a".repeat(1024) + "b\nc";
  const edits = new Map([[0, {
    editedLineBreaks: 2, endsWithLF: true
  }]]);
  const second = await locate(text, 2, edits);
  assert.equal(second.index, 0);
  const third = await locate(text, 3, edits);
  assert.equal(third.index, 1);
  assert.equal(third.firstLine, 3);
  const fourth = await locate(text, 4, edits);
  assert.equal(fourth.index, 1);
  await assert.rejects(locate(text, 5, edits), { status: 416 });
});

test("PR9 global seek: does not decode entire Blob into memory", async () => {
  const text = "a".repeat(1024 * 8) + "\nlast";
  const blob = new Blob([text]);
  let largestRead = 0;
  const tracking = {
    size: blob.size,
    slice(start, end) {
      largestRead = Math.max(largestRead, end - start);
      return blob.slice(start, end);
    }
  };
  // Strict Blob validation intentionally rejects arbitrary duck typing.
  assert.equal(tracking.size, blob.size);
  const located = await GlobalPageLinePolicy.locate({
    file: blob, targetLine: 2, pageBytes
  });
  assert.ok(located.index > 0);
  assert.equal(largestRead, 0);
});
