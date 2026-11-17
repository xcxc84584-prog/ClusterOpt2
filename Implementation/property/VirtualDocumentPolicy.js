/**
 * Decides when legacy full-buffer loading must yield to a bounded
 * virtual page. No UI component may silently bypass this boundary.
 */
export const VirtualDocumentPolicy = Object.freeze({
  legacyMaxBytes: 64 * 1024 * 1024,
  isVirtual(size) {
    if (!Number.isSafeInteger(size) || size < 0) {
      const error = new RangeError("Invalid virtual file size");
      error.status = 400;
      throw error;
    }
    return size > this.legacyMaxBytes;
  },

  /** All real, Blob-backed selected files use the same slice engine. */
  isUniformSliceFile(file) {
    return !!file && typeof file.slice === "function" &&
      this.isVirtual(file.size) !== null;
  }
});
