import test from "node:test";
import assert from "node:assert/strict";
import { GoToLinePolicy } from "../property/GoToLinePolicy.js";

test("PR9: exact lines including CRLF, UTF-16 and last empty line", () => {
  const text = "甲\r\n😀\n";
  assert.deepEqual(GoToLinePolicy.resolve({
    text, firstLine: 1, targetLine: 2, lineHeight: 24
  }), { offset: 3, scrollTop: 24 });
  assert.deepEqual(GoToLinePolicy.resolve({
    text, firstLine: 1, targetLine: 3, lineHeight: 24
  }), { offset: text.length, scrollTop: 48 });
});
test("PR9: page-local global numbering and rejection", () => {
  assert.deepEqual(GoToLinePolicy.resolve({
    text: "a\nb", firstLine: 200, targetLine: 201, lineHeight: 17.5
  }), { offset: 2, scrollTop: 17.5 });
  for (const targetLine of [0, 199, 202, NaN, 1.5]) {
    assert.throws(() => GoToLinePolicy.resolve({
      text: "a\nb", firstLine: 200, targetLine, lineHeight: 18
    }), RangeError);
  }
});
