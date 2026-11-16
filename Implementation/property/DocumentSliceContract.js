/**
 * Unified public descriptor for file-backed documents.
 * Compatibility mode is explicit; it is not a claim that a full
 * legacy textarea has been replaced by bounded slice rendering.
 */
export const DocumentSliceContract = Object.freeze({
  version: 1,
  describe(document, byteLength) {
    if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
      const error = new RangeError("Invalid document byte length");
      error.status = 400;
      throw error;
    }
    const virtual = Boolean(document.virtualReadOnly);
    const chunkBytes = virtual ? 64 * 1024 : byteLength;
    const count = virtual ?
      Math.max(1, Math.ceil(byteLength / chunkBytes)) : 1;
    return Object.freeze({
      documentId: document.id,
      contractVersion: this.version,
      mode: virtual ? "virtual-page" : "legacy-compatibility",
      byteLength, chunkBytes, count,
      currentIndex: virtual ? document.virtualPageIndex : 0,
      dirty: document.status === "yellow"
    });
  }
});
