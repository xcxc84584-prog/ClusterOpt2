/**
 * Bounded and versioned recovery schema. Untrusted IndexedDB snapshots
 * must be validated before any live editor object is changed.
 */
export const RecoveryPolicy = Object.freeze({
  schema: 1,
  maxDocuments: 100,
  maxTextBytes: 8 * 1024 * 1024,
  maxRoots: 40,
  isDocument(value) {
    return value && typeof value.name === "string" &&
      value.name.length <= 1024 && typeof value.text === "string" &&
      new TextEncoder().encode(value.text).byteLength <= this.maxTextBytes &&
      Number.isFinite(value.scrollTop) && value.scrollTop >= 0 &&
      Number.isFinite(value.cursor) && value.cursor >= 0;
  },
  isSnapshot(value) {
    return value?.schema === this.schema &&
      Array.isArray(value.documents) &&
      value.documents.length <= this.maxDocuments &&
      value.documents.every(item => this.isDocument(item)) &&
      Array.isArray(value.roots) &&
      value.roots.length <= this.maxRoots &&
      value.roots.every(item =>
        item?.handle?.kind === "directory" &&
        typeof item.name === "string");
  }
});
