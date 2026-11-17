import test from "node:test";
import assert from "node:assert/strict";
import { VirtualPageLinePolicy } from
  "../property/VirtualPageLinePolicy.js";

test("PR8 uniform slicing: unchanged textarea-normalized CRLF is no-op", () => {
  const source = "甲\r\nsecond\r\n";
  assert.equal(
    VirtualPageLinePolicy.sourceTextFromEditor(source, "甲\nsecond\n"),
    source);
});

test("PR8 uniform slicing: edit preserves old CRLF and mixed LF bytes", () => {
  const source = "甲\r\nsecond\nthird\r\n";
  const changed = "甲\nUPDATED\nthird\n";
  const output = VirtualPageLinePolicy.sourceTextFromEditor(source, changed);
  assert.equal(output, "甲\r\nUPDATED\nthird\r\n");
  assert.equal((output.match(/\r\n/g) || []).length, 2);
});

test("PR8 uniform slicing: inserted newline uses original CRLF style", () => {
  const source = "A\r\nB";
  const output = VirtualPageLinePolicy.sourceTextFromEditor(
    source, "A\nNEW\nB");
  assert.equal(output, "A\r\nNEW\r\nB");
});
