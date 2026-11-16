/**
 * Integrity policy for bounded slice checkpoints. SHA-256 detects
 * accidental corruption; this is not an authentication mechanism.
 */
export const SliceJournalPolicy = Object.freeze({
  schema: 1,
  maxTextUnits: 1024 * 1024,

  validate(id, revision, text) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) ||
        !Number.isSafeInteger(revision) || revision < 0 ||
        typeof text !== "string" || text.length > this.maxTextUnits) {
      const error = new RangeError("Invalid slice journal entry");
      error.status = 400;
      throw error;
    }
  },

  async checksum(id, revision, text) {
    this.validate(id, revision, text);
    if (!globalThis.crypto?.subtle) {
      const error = new Error("SHA-256 is unavailable");
      error.status = 503;
      throw error;
    }
    const bytes = new TextEncoder().encode(
      JSON.stringify([this.schema, id, revision, text]));
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), byte =>
      byte.toString(16).padStart(2, "0")).join("");
  },

  async seal(id, revision, text) {
    return {
      schema: this.schema, id, revision, text,
      checksum: await this.checksum(id, revision, text)
    };
  },

  async verify(entry) {
    if (!entry || entry.schema !== this.schema ||
        typeof entry.checksum !== "string" ||
        !/^[0-9a-f]{64}$/.test(entry.checksum)) {
      const error = new Error("Unsupported slice journal schema");
      error.status = 422;
      throw error;
    }
    try {
      this.validate(entry.id, entry.revision, entry.text);
    } catch {
      const error = new Error("Corrupt slice journal fields");
      error.status = 422;
      throw error;
    }
    if (entry.checksum !== await this.checksum(
      entry.id, entry.revision, entry.text)) {
      const error = new Error("Slice journal checksum mismatch");
      error.status = 422;
      throw error;
    }
    return entry;
  }
});
