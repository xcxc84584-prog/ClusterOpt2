import test from "node:test";
import assert from "node:assert/strict";
import { EditorInteractionPolicy } from
  "../property/EditorInteractionPolicy.js";

test("PR8 viewport raw indentation preserves literal tabs", () => {
  const view = EditorInteractionPolicy.guideWindow(
    "\tstart\n  \tblock\nplain\n", 0, 22, 70);
  assert.deepEqual(view.rawIndents.slice(0, 3),
    ["\t", "  \t", ""]);
  assert.equal(view.lines[0], "┊   ");
});

test("PR8 scrolled mirror returns only visible indentation", () => {
  const text = Array.from({ length: 300 },
    (_, i) => "\tline " + i).join("\n");
  const view = EditorInteractionPolicy.guideWindow(
    text, 2200, 22, 110);
  assert.equal(view.firstLine, 100);
  assert.equal(view.rawIndents[0], "\t");
  assert.ok(view.rawIndents.length <= 160);
});
