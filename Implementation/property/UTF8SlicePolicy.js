/**
 * File byte ranges are half-open: [start, end).
 * Align chunk boundaries forward to the next UTF-8 code point.
 * This policy never requests the whole Blob unless it is one slice.
 */
export const UTF8SlicePolicy = Object.freeze({
  defaultChunkBytes: 64 * 1024,
  maxChunkBytes: 1024 * 1024,

  chunkBytes(value) {
    if (!Number.isSafeInteger(value) || value < 1024 ||
        value > this.maxChunkBytes) {
      throw new RangeError("Invalid chunk size");
    }
    return value;
  },

  count(size, bytes) {
    this.chunkBytes(bytes);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new RangeError("Invalid file size");
    }
    return Math.ceil(size / bytes);
  },

  range(size, index, bytes) {
    const count = this.count(size, bytes);
    if (!Number.isSafeInteger(index) || index < 0 || index >= count) {
      throw new RangeError("Slice index out of range");
    }
    return {
      start: index * bytes,
      end: Math.min(size, (index + 1) * bytes)
    };
  },

  async boundary(blob, offset) {
    if (offset === 0 || offset === blob.size) return offset;
    const lookahead = new Uint8Array(await blob.slice(
      offset, Math.min(offset + 4, blob.size)).arrayBuffer());
    for (let i = 0; i < lookahead.length; i++) {
      if ((lookahead[i] & 0xc0) !== 0x80) return offset + i;
    }
    const error = new TypeError("Invalid UTF-8 boundary");
    error.status = 422;
    throw error;
  },

  async read(blob, index, bytes) {
    const range = this.range(blob.size, index, bytes);
    const [start, end] = await Promise.all([
      this.boundary(blob, range.start),
      this.boundary(blob, range.end)
    ]);
    const raw = await blob.slice(start, end).arrayBuffer();
    try {
      const text = new TextDecoder("utf-8", {
        fatal: true, ignoreBOM: true
      }).decode(raw);
      return { start, end, text };
    } catch {
      const error = new TypeError("Invalid UTF-8 input");
      error.status = 422;
      throw error;
    }
  }
});
