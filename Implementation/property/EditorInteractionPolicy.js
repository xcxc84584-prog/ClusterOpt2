/**
 * Shared editor behavior algorithm. Pure transformations, no DOM mutations.
 * Design follows VS Code/Monaco's autoClosingPairs and indentation contracts.
 */
const PAIRS = Object.freeze({
  "(": ")", "[": "]", "{": "}", "<": ">",
  '"': '"', "'": "'"
});
const CLOSERS = new Set(Object.values(PAIRS));
const SAFE_NEXT = /[\s\)\]\}\>,;:]/;

export const EditorInteractionPolicy = Object.freeze({
  tabWidth: 4,

  /** Return a focused replacement edit, or null for native editing. */
  transform(text, start, end, key, options = {}) {
    const before = text.slice(0, start);
    const next = text[start] ?? "";
    const selected = text.slice(start, end);
    const previous = text[start - 1] ?? "";
    if (options.shiftKey && key === "Tab") return null;
    if (key === "Tab") {
      return { start, end, insert: "\t", caret: start + 1 };
    }
    if (key === "Backspace" && start === end) {
      for (const [open, close] of Object.entries(PAIRS)) {
        if (previous === open && next === close) {
          return { start: start - 1, end: start + 1,
            insert: "", caret: start - 1 };
        }
      }
      const lineStart = before.lastIndexOf("\n") + 1;
      const indent = before.slice(lineStart);
      if (/^ +$/.test(indent)) {
        const count = ((indent.length - 1) % this.tabWidth) + 1;
        return { start: start - count, end: start,
          insert: "", caret: start - count };
      }
      if (previous === "\t") {
        return { start: start - 1, end: start,
          insert: "", caret: start - 1 };
      }
    }
    if (key === "Enter") {
      const prefix = before.slice(before.lastIndexOf("\n") + 1);
      const base = (prefix.match(/^[\t ]*/) ?? [""])[0];
      const extra = /[\{\[\(]$/.test(prefix.trimEnd()) ? "\t" : "";
      if (start === end && PAIRS[previous] === next && extra) {
        return { start, end, insert: "\n" + base + extra + "\n" + base,
          caret: start + 1 + base.length + 1 };
      }
      return { start, end, insert: "\n" + base + extra,
        caret: start + 1 + base.length + extra.length };
    }
    // Quotation marks serve as both openers and closers.
    if (start === end && (key === '"' || key === "'") &&
        next === key && !options.composing) {
      return { start, end: start + 1, insert: key, caret: start + 1 };
    }
    if (Object.hasOwn(PAIRS, key)) {
      if (options.composing) return null;
      if (selected) {
        return { start, end, insert: key + selected + PAIRS[key],
          caret: start + 1, selectionEnd: start + 1 + selected.length };
      }
      if (start === end && (next === "" || SAFE_NEXT.test(next))) {
        if ((key === '"' || key === "'") && previous === "\\") {
          return null;
        }
        return { start, end, insert: key + PAIRS[key], caret: start + 1 };
      }
      return null;
    }
    if (CLOSERS.has(key) && start === end && key === next) {
      return { start, end: start + 1, insert: key, caret: start + 1 };
    }
    return null;
  },

  /** Compute indentation guides for just the viewport and guard rows. */
  guideWindow(text, scrollTop, lineHeight, viewportHeight,
    hint = null) {
    const firstLine = Math.max(0, Math.floor(scrollTop / lineHeight));
    const count = Math.min(160,
      Math.ceil(viewportHeight / lineHeight) + 3);
    // Reuse a verified viewport anchor while scrolling. Edits invalidate
    // the anchor in the UI and avoid offset drift.
    let cursor = Number.isInteger(hint?.offset) ? hint.offset : 0;
    let line = Number.isInteger(hint?.firstLine) ? hint.firstLine : 0;
    if (cursor < 0 || cursor > text.length || line < 0) {
      cursor = 0;
      line = 0;
    }
    while (line < firstLine && cursor < text.length) {
      const next = text.indexOf("\n", cursor);
      if (next < 0) {
        return { firstLine, lines: [], offset: text.length };
      }
      cursor = next + 1;
      line++;
    }
    while (line > firstLine) {
      cursor = text.lastIndexOf("\n", Math.max(0, cursor - 2)) + 1;
      line--;
    }
    const offset = cursor;
    const lines = [];
    for (let i = 0; i < count && cursor <= text.length; i++) {
      const next = text.indexOf("\n", cursor);
      const ending = next < 0 ? text.length : next;
      const raw = text.slice(cursor, ending);
      const indent = (raw.match(/^[\t ]*/) ?? [""])[0];
      lines.push(indent.replace(/[^\t]/g, " ")
        .replace(/\t/g, "┊   "));
      if (next < 0) break;
      cursor = next + 1;
    }
    return { firstLine, lines, offset };
  }
});
