/**
 * Bounded-memory byte-splice writer for an authorized file handle.
 * Browser createWritable typically swaps a temporary file on close,
 * but cannot guarantee full OS-level atomicity or external lock safety.
 */
export const SliceFileWritePolicy = Object.freeze({
  blockBytes: 64 * 1024,
  maxSliceBytes: 4 * 1024 * 1024,

  fail(message, status) {
    const error = new Error(message);
    error.status = status;
    throw error;
  },

  async digest(bytes) {
    if (!globalThis.crypto?.subtle) {
      this.fail("SHA-256 unavailable", 503);
    }
    const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map(byte =>
      byte.toString(16).padStart(2, "0")).join("");
  },

  validate(payload, file, encoded) {
    const { start, end, expectedSize, expectedLastModified,
      expectedSliceHash } = payload;
    if (!Number.isSafeInteger(start) || start < 0 ||
        !Number.isSafeInteger(end) || end < start ||
        !Number.isSafeInteger(expectedSize) ||
        expectedSize !== file.size || end > file.size ||
        !Number.isFinite(expectedLastModified) ||
        !/^[0-9a-f]{64}$/.test(expectedSliceHash ?? "")) {
      this.fail("Invalid writeback range or fingerprint", 400);
    }
    if (encoded.length > this.maxSliceBytes ||
        end - start > this.maxSliceBytes) {
      this.fail("Writeback slice exceeds byte budget", 413);
    }
    if (file.lastModified !== expectedLastModified) {
      this.fail("External file revision changed", 409);
    }
  },

  async writeBlob(writer, blob, start, end) {
    for (let offset = start; offset < end;
      offset += this.blockBytes) {
      const stop = Math.min(end, offset + this.blockBytes);
      await writer.write(new Uint8Array(
        await blob.slice(offset, stop).arrayBuffer()));
    }
  },

  async verifyRegion(file, offset, expected) {
    for (let cursor = 0; cursor < expected.length;
      cursor += this.blockBytes) {
      const end = Math.min(cursor + this.blockBytes, expected.length);
      const actual = new Uint8Array(await file.slice(
        offset + cursor, offset + end).arrayBuffer());
      const chunk = expected.subarray(cursor, end);
      if (actual.length !== chunk.length ||
          chunk.some((byte, index) => byte !== actual[index])) {
        this.fail("Readback byte mismatch", 422);
      }
    }
  },

  async verifyUntouched(before, after, prefix, suffixStart,
    afterSuffixStart) {
    for (const [oldOffset, newOffset, length] of [
      [0, 0, prefix],
      [suffixStart, afterSuffixStart, before.size - suffixStart]
    ]) {
      for (let n = 0; n < length; n += this.blockBytes) {
        const end = Math.min(n + this.blockBytes, length);
        const left = new Uint8Array(await before.slice(
          oldOffset + n, oldOffset + end).arrayBuffer());
        const right = new Uint8Array(await after.slice(
          newOffset + n, newOffset + end).arrayBuffer());
        if (left.length !== right.length ||
            left.some((byte, index) => byte !== right[index])) {
          this.fail("Unmodified file bytes differ after writeback", 422);
        }
      }
    }
  },

  async commit(handle, payload, text) {
    if (!handle || typeof handle.getFile !== "function" ||
        typeof handle.createWritable !== "function") {
      this.fail("Authorized writable handle required", 400);
    }
    const encoded = new TextEncoder().encode(text);
    const original = await handle.getFile();
    this.validate(payload, original, encoded);
    const { start, end, expectedSliceHash } = payload;
    const oldRegion = await original.slice(start, end).arrayBuffer();
    if (await this.digest(oldRegion) !== expectedSliceHash) {
      this.fail("Edited source slice changed externally", 409);
    }
    // A second check narrows the race between snapshot and stream open.
    const current = await handle.getFile();
    if (current.size !== original.size ||
        current.lastModified !== original.lastModified) {
      this.fail("File changed before writeback", 409);
    }

    let writer;
    let closed = false;
    try {
      writer = await handle.createWritable({
        keepExistingData: false, mode: "exclusive"
      });
      await this.writeBlob(writer, original, 0, start);
      await writer.write(encoded);
      await this.writeBlob(writer, original, end, original.size);
      await writer.close();
      closed = true;
    } catch (error) {
      if (writer && !closed && typeof writer.abort === "function") {
        try { await writer.abort(); } catch { /* preserve failure */ }
      }
      if (Number.isInteger(error.status)) throw error;
      const failure = new Error("File writeback failed: " + String(error));
      failure.status = error.name === "NoModificationAllowedError" ?
        409 : 503;
      throw failure;
    }

    // Journal is deliberately retained even after success. A crash
    // between stream close and verification must remain recoverable.
    const saved = await handle.getFile();
    const expectedSize = original.size - (end - start) + encoded.length;
    if (saved.size !== expectedSize) {
      this.fail("Writeback size mismatch", 422);
    }
    await this.verifyRegion(saved, start, encoded);
    await this.verifyUntouched(original, saved, start,
      end, start + encoded.length);
    return { bytes: saved.size, insertedBytes: encoded.length,
      verified: true, retainedJournal: true };
  }
});
