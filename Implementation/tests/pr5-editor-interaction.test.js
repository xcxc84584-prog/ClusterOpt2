import test from "node:test";
import assert from "node:assert/strict";
import { EditorInteractionPolicy as policy } from
  "../property/EditorInteractionPolicy.js";

test("PR5 automatically pairs brackets, quotes and angle brackets", () => {
  const cases = [
    ["(", "()"], ["[", "[]"], ["{", "{}"],
    ["<", "<>"], ['"', '""'], ["'", "''"]
  ];
  for (const [key, expected] of cases) {
    const edit = policy.transform("", 0, 0, key);
    assert.equal(edit.insert, expected);
    assert.equal(edit.caret, 1);
  }
});

test("PR5 surrounds selected text and overtypes closing symbols", () => {
  const surround = policy.transform("word", 0, 4, "[");
  assert.deepEqual(surround, {
    start: 0, end: 4, insert: "[word]",
    caret: 1, selectionEnd: 5
  });
  assert.deepEqual(policy.transform("()", 1, 1, ")"), {
    start: 1, end: 2, insert: ")", caret: 2
  });
  assert.equal(policy.transform("text", 2, 2, "("), null);
  assert.equal(policy.transform("\\", 1, 1, '"'), null);
});

test("PR5 deletes pairs and indentation without damaging text", () => {
  assert.deepEqual(policy.transform("{}", 1, 1, "Backspace"), {
    start: 0, end: 2, insert: "", caret: 0
  });
  assert.deepEqual(policy.transform("    hello", 4, 4, "Backspace"), {
    start: 0, end: 4, insert: "", caret: 0
  });
  assert.deepEqual(policy.transform("\thello", 1, 1, "Backspace"), {
    start: 0, end: 1, insert: "", caret: 0
  });
});

test("PR5 Enter keeps indentation and expands brace blocks", () => {
  assert.deepEqual(policy.transform("  abc", 5, 5, "Enter"), {
    start: 5, end: 5, insert: "\n  ", caret: 8
  });
  assert.deepEqual(policy.transform("{}", 1, 1, "Enter"), {
    start: 1, end: 1, insert: "\n\t\n", caret: 3
  });
  assert.deepEqual(policy.transform("  {", 3, 3, "Enter"), {
    start: 3, end: 3, insert: "\n  \t", caret: 7
  });
});

test("PR5 guideWindow limits data to visible lines", () => {
  const data = "\tfirst\n  second\nthird\n  fourth\n";
  const view = policy.guideWindow(data, 22, 22, 22);
  assert.equal(view.firstLine, 1);
  assert.equal(view.lines[0], "  ");
  assert.ok(view.lines.length <= 5);
});
