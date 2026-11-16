/**
 * Read-optimized grouped offset index over piece-tree leaves.
 * This first-stage auxiliary index is rebuilt lazily after edits.
 * Rebuild: O(number of pieces); lookup: O(log number of pieces).
 */
export const BPlusSliceIndex = Object.freeze({
  fanout: 32,
  build(pieces) {
    const leaves = [];
    let offset = 0;
    let batch = [];
    for (const text of pieces) {
      batch.push(Object.freeze({ start: offset, end: offset +
        text.length }));
      offset += text.length;
      if (batch.length === this.fanout) {
        leaves.push(Object.freeze({
          start: batch[0].start, end: offset,
          entries: Object.freeze(batch)
        }));
        batch = [];
      }
    }
    if (batch.length) {
      leaves.push(Object.freeze({
        start: batch[0].start, end: offset,
        entries: Object.freeze(batch)
      }));
    }
    return Object.freeze({ length: offset, groups: Object.freeze(leaves) });
  },
  seek(index, offset) {
    if (!Number.isSafeInteger(offset) || offset < 0 ||
        offset >= index.length) {
      throw new RangeError("Index offset outside text");
    }
    const locate = (items) => {
      let low = 0;
      let high = items.length - 1;
      while (low <= high) {
        const mid = (low + high) >>> 1;
        const entry = items[mid];
        if (offset < entry.start) high = mid - 1;
        else if (offset >= entry.end) low = mid + 1;
        else return mid;
      }
      throw new Error("Corrupt offset index");
    };
    const group = index.groups[locate(index.groups)];
    const entry = group.entries[locate(group.entries)];
    return { start: entry.start, end: entry.end,
      localOffset: offset - entry.start };
  }
});
