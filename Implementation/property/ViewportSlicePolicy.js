/**
 * PR8 viewport plan in logical byte-slice indexes. A later layout mapper
 * converts pixel/line position to these indexes without full-file reads.
 */
export const ViewportSlicePolicy = Object.freeze({
  maxVisible: 16,
  maxPreload: 2,
  plan(count, first, last, adjacent = 1) {
    if (!Number.isSafeInteger(count) || count < 1 ||
        !Number.isSafeInteger(first) || !Number.isSafeInteger(last) ||
        first < 0 || last < first || last >= count ||
        last - first + 1 > this.maxVisible ||
        !Number.isSafeInteger(adjacent) ||
        adjacent < 0 || adjacent > this.maxPreload) {
      const error = new RangeError("Invalid viewport slice range");
      error.status = 400;
      throw error;
    }
    const full = [];
    const preloaded = [];
    for (let i = first; i <= last; i++) full.push(i);
    for (let i = Math.max(0, first - adjacent); i < first; i++) {
      preloaded.push(i);
    }
    for (let i = last + 1; i <= Math.min(count - 1,
      last + adjacent); i++) preloaded.push(i);
    return { full, preloaded };
  }
});
