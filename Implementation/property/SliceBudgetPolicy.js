/**
 * PR8 resident slice budget. All planning is pure and happens before
 * cache mutations; dirty/visible chunks are never discarded silently.
 */
export const SliceBudgetPolicy = Object.freeze({
  defaultBytes: 8 * 1024 * 1024,
  maxBytes: 1024 * 1024 * 1024,
  states: Object.freeze({
    VIRTUAL: "virtual",
    PRELOADED: "preloaded",
    FULL: "full"
  }),
  validateLimit(bytes) {
    if (bytes === null) return null; // Off: no memory cap.
    if (!Number.isSafeInteger(bytes) || bytes < 1024 ||
        bytes > this.maxBytes) {
      const error = new RangeError("Invalid slice cache limit");
      error.status = 400;
      throw error;
    }
    return bytes;
  },
  measure(text) {
    if (typeof text !== "string") {
      const error = new TypeError("Slice data must be text");
      error.status = 400;
      throw error;
    }
    return new TextEncoder().encode(text).byteLength;
  },
  /**
   * Pick preloads first, then clean full slices outside the viewport.
   * Reject the request before any mutation if the budget cannot be met.
   */
  evictions(entries, targetId, requestedBytes, limit, visibleIds) {
    if (limit === null) return [];
    let used = entries.reduce((total, entry) =>
      total + entry.residentBytes, 0);
    const target = entries.find(entry => entry.id === targetId);
    used += requestedBytes - (target?.residentBytes ?? 0);
    if (used <= limit) return [];
    const candidates = entries.filter(entry =>
      entry.id !== targetId && entry.residentBytes > 0 &&
      !entry.dirty && !visibleIds.has(entry.id))
      .sort((a, b) => {
        if (a.state !== b.state) {
          return a.state === this.states.PRELOADED ? -1 : 1;
        }
        return a.lastUsed - b.lastUsed;
      });
    const removed = [];
    for (const entry of candidates) {
      removed.push(entry.id);
      used -= entry.residentBytes;
      if (used <= limit) return removed;
    }
    const error = new RangeError("Slice cache memory limit exceeded");
    error.status = 413;
    throw error;
  }
});
