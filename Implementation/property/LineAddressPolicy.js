/**
 * Pure line-address scanning policy. UTF-8 continuation bytes cannot
 * equal 0x0A, so line-feed byte locations are encoding-independent.
 * CRLF counts as one break; bare CR is not treated as a newline.
 */
export const LineAddressPolicy = Object.freeze({
  readBytes: 64 * 1024,
  checkpointStride: 4096,
  maxRequestedLines: 8192,

  checkLine(line) {
    if (!Number.isSafeInteger(line) || line < 1) {
      const error = new RangeError("Line must be a positive integer");
      error.status = 400;
      throw error;
    }
    return line;
  },

  checkRange(firstLine, lastLine) {
    this.checkLine(firstLine);
    this.checkLine(lastLine);
    if (lastLine < firstLine ||
        lastLine === Number.MAX_SAFE_INTEGER ||
        lastLine - firstLine >= this.maxRequestedLines) {
      const error = new RangeError("Line range exceeds safe limit");
      error.status = 400;
      throw error;
    }
  },

  /**
   * Scan bounded Blob windows and emit sparse line checkpoints.
   * A locate operation may scan forward to an unindexed line, but
   * does not allocate the decoded contents of those windows.
   */
  async scan(blob, anchor, targetLine, checkpoint = () => {}) {
    let line = anchor.line;
    let offset = anchor.offset;
    let windows = 0;
    while (offset < blob.size) {
      const end = Math.min(blob.size, offset + this.readBytes);
      const bytes = new Uint8Array(
        await blob.slice(offset, end).arrayBuffer());
      if (!bytes.length) {
        const error = new Error("Blob scan failed to advance");
        error.status = 422;
        throw error;
      }
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] !== 0x0a) continue;
        line++;
        const nextOffset = offset + i + 1;
        if ((line - 1) % this.checkpointStride === 0) {
          checkpoint({ line, offset: nextOffset });
        }
        if (line === targetLine) {
          return { line, offset: nextOffset, eof: false };
        }
      }
      offset = end;
      // Yield between bounded batches to allow browser rendering.
      if (++windows % 8 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    return { line, offset: blob.size, eof: true };
  },

  anchor(checkpoints, line) {
    let low = 0;
    let high = checkpoints.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (checkpoints[middle].line <= line) low = middle;
      else high = middle - 1;
    }
    return checkpoints[low];
  }
});
