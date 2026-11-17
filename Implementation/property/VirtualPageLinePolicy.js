/**
 * Global LF numbering for byte-paged UTF-8 files.
 *
 * Scans only bounded Blob ranges. Cache records completed byte
 * prefixes; after a writeback, invalidate it because later byte
 * addresses and line positions may change.
 */
export const VirtualPageLinePolicy = Object.freeze({
  blockBytes: 64 * 1024,

  async prefix(blob, byteEnd, checkpoint = { byte: 0, lines: 0 }) {
    if (!Number.isSafeInteger(byteEnd) || byteEnd < 0 ||
        byteEnd > blob.size || !Number.isSafeInteger(checkpoint.byte) ||
        checkpoint.byte < 0 || checkpoint.byte > byteEnd ||
        !Number.isSafeInteger(checkpoint.lines) ||
        checkpoint.lines < 0) {
      const error = new RangeError("Invalid global line prefix");
      error.status = 400;
      throw error;
    }
    let lines = checkpoint.lines;
    let scanned = 0;
    for (let byte = checkpoint.byte; byte < byteEnd;
      byte += this.blockBytes) {
      const end = Math.min(byteEnd, byte + this.blockBytes);
      const buffer = new Uint8Array(
        await blob.slice(byte, end).arrayBuffer());
      if (buffer.length !== end - byte) {
        const error = new Error("Incomplete line-index scan");
        error.status = 422;
        throw error;
      }
      for (const current of buffer) if (current === 10) lines++;
      if (++scanned % 8 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    return { byte: byteEnd, lines, firstLine: lines + 1 };
  },

  lineNumber(base, local) {
    if (!Number.isSafeInteger(base) || base < 1 ||
        !Number.isSafeInteger(local) || local < 1) {
      const error = new RangeError("Invalid line position");
      error.status = 400;
      throw error;
    }
    return base + local - 1;
  },

  /**
   * Textarea normalizes CRLF to LF; restore original line endings only
   * for the edited span. Untouched mixed LF/CRLF bytes remain exact.
   */
  sourceTextFromEditor(source, editorText) {
    if (typeof source !== "string" ||
        typeof editorText !== "string") {
      const error = new TypeError("Invalid editor page text");
      error.status = 400;
      throw error;
    }
    const canonical = source.replace(/\r\n/g, "\n");
    if (canonical === editorText) return source;
    if (canonical === source) return editorText;
    const edit = this.change(canonical, editorText);
    const rawOffset = target => {
      let offset = 0;
      let normalized = 0;
      while (offset < source.length && normalized < target) {
        if (source[offset] === "\r" && source[offset + 1] === "\n") {
          offset += 2;
        } else {
          offset++;
        }
        normalized++;
      }
      return offset;
    };
    const first = rawOffset(edit.start);
    const last = rawOffset(edit.end);
    // Original untouched spans retain their exact original encoding.
    const addition = edit.text.replace(/\r?\n/g, "\r\n");
    return source.slice(0, first) + addition + source.slice(last);
  },

  /**
   * Calculate a minimal splice for the entire bounded visible page.
   * This converts textarea selection (UTF-16) into PieceTree edits.
   */
  change(before, after) {
    if (typeof before !== "string" || typeof after !== "string") {
      const error = new TypeError("Invalid bounded page edit");
      error.status = 400;
      throw error;
    }
    let start = 0;
    while (start < before.length && start < after.length &&
        before.charCodeAt(start) === after.charCodeAt(start)) start++;
    let endBefore = before.length;
    let endAfter = after.length;
    while (endBefore > start && endAfter > start &&
        before.charCodeAt(endBefore - 1) ===
        after.charCodeAt(endAfter - 1)) {
      endBefore--;
      endAfter--;
    }
    return { type: "replace", start, end: endBefore,
      text: after.slice(start, endAfter) };
  }
});
