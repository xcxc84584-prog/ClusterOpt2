/**
 * MVCC multi-slice disk write policy. Unchanged spans are never
 * decoded into JavaScript strings or individually re-hashed.
 *
 * Equal-byte-size edits use keepExistingData + positioned writes.
 * Length-changing edits stream source Blob regions unchanged.
 * Both paths verify every edited region after close, while the
 * browser/OS remains responsible for preserving untouched bytes.
 */
export const SliceBatchWritePolicy = Object.freeze({
  blockBytes: 1024 * 1024,
  maxSliceBytes: 4 * 1024 * 1024,

  fail(message, status) {
    const error = new Error(message);
    error.status = status;
    throw error;
  },

  async digest(bytes) {
    if (!globalThis.crypto?.subtle) this.fail("SHA-256 unavailable", 503);
    const data = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(data)].map(byte =>
      byte.toString(16).padStart(2, "0")).join("");
  },

  checkAbort(signal) {
    if (signal?.aborted) {
      this.fail("Batch write interrupted by editing", 499);
    }
  },

  async yieldFrame() {
    await new Promise(resolve => setTimeout(resolve, 0));
  },

  validate(original, payload, edits) {
    if (!original || !Number.isSafeInteger(payload.expectedSize) ||
        !Number.isFinite(payload.expectedLastModified) ||
        original.size !== payload.expectedSize ||
        original.lastModified !== payload.expectedLastModified ||
        !Array.isArray(edits) || !edits.length) {
      this.fail("Stale file or invalid batch", 409);
    }
    let previousEnd = 0;
    for (const item of edits) {
      if (!Number.isSafeInteger(item.start) || item.start < previousEnd ||
          !Number.isSafeInteger(item.end) || item.end < item.start ||
          item.end > original.size ||
          !/^[0-9a-f]{64}$/.test(item.sourceHash ?? "") ||
          typeof item.text !== "string") {
        this.fail("Overlapping or invalid slice batch", 400);
      }
      item.encoded = new TextEncoder().encode(item.text);
      if (item.encoded.length > this.maxSliceBytes ||
          item.end - item.start > this.maxSliceBytes) {
        this.fail("Slice exceeds writeback budget", 413);
      }
      previousEnd = item.end;
    }
  },

  async copyUnchanged(writer, blob, start, end, advance, signal) {
    for (let offset = start; offset < end;
      offset += this.blockBytes) {
      this.checkAbort(signal);
      const stop = Math.min(end, offset + this.blockBytes);
      // Native Blob parts avoid unnecessary JS buffers and hashing.
      await writer.write(blob.slice(offset, stop));
      advance(stop - offset);
      await this.yieldFrame();
    }
  },

  async commit(handle, payload, edits) {
    if (!handle || typeof handle.getFile !== "function" ||
        typeof handle.createWritable !== "function") {
      this.fail("Authorized writable handle required", 400);
    }
    const original = await handle.getFile();
    this.validate(original, payload, edits);
    const ordered = [...edits].sort((a, b) => a.start - b.start);
    let previousEnd = 0;
    let insertedBytes = 0;
    let replacedBytes = 0;
    for (const item of ordered) {
      if (item.start < previousEnd) {
        this.fail("Overlapping dirty page ranges", 409);
      }
      previousEnd = item.end;
      insertedBytes += item.encoded.length;
      replacedBytes += item.end - item.start;
      const old = await original.slice(item.start, item.end)
        .arrayBuffer();
      if (await this.digest(old) !== item.sourceHash) {
        this.fail("Source slice changed before write", 409);
      }
    }
    this.checkAbort(payload.signal);
    const current = await handle.getFile();
    if (current.size !== original.size ||
        current.lastModified !== original.lastModified) {
      this.fail("External file modified before write", 409);
    }
    const equalLength = ordered.every(item =>
      item.encoded.length === item.end - item.start);
    const expectedSize = original.size - replacedBytes + insertedBytes;
    const ioBytes = equalLength ? insertedBytes :
      original.size - replacedBytes + insertedBytes;
    const total = Math.max(1, ioBytes + insertedBytes);
    let completed = 0;
    const advance = amount => {
      completed += amount;
      payload.onProgress?.(Math.min(99,
        Math.floor(completed * 99 / total)));
    };
    let writer;
    let closed = false;
    const offsets = [];
    try {
      writer = await handle.createWritable({
        keepExistingData: equalLength, mode: "exclusive"
      });
      if (equalLength) {
        for (const item of ordered) {
          this.checkAbort(payload.signal);
          await writer.write({
            type: "write", position: item.start, data: item.encoded
          });
          offsets.push(item.start);
          advance(item.encoded.length);
          await this.yieldFrame();
        }
      } else {
        let previous = 0;
        let output = 0;
        for (const item of ordered) {
          await this.copyUnchanged(writer, original, previous,
            item.start, advance, payload.signal);
          output += item.start - previous;
          this.checkAbort(payload.signal);
          offsets.push(output);
          await writer.write(item.encoded);
          advance(item.encoded.length);
          output += item.encoded.length;
          previous = item.end;
        }
        await this.copyUnchanged(writer, original, previous,
          original.size, advance, payload.signal);
      }
      this.checkAbort(payload.signal);
      await writer.close();
      closed = true;
    } catch (error) {
      if (writer && !closed && typeof writer.abort === "function") {
        try { await writer.abort(); } catch { /* original failure */ }
      }
      if (Number.isInteger(error.status)) throw error;
      this.fail("Batch file write failed: " + String(error),
        error.name === "NoModificationAllowedError" ? 409 : 503);
    }
    // After close, cancellation must not bypass verification.
    const saved = await handle.getFile();
    if (saved.size !== expectedSize) {
      this.fail("Saved file length mismatch", 422);
    }
    for (let i = 0; i < ordered.length; i++) {
      const item = ordered[i];
      const actual = await saved.slice(offsets[i],
        offsets[i] + item.encoded.length).arrayBuffer();
      if (await this.digest(actual) !==
          await this.digest(item.encoded)) {
        this.fail("Edited slice readback differs", 422);
      }
      advance(item.encoded.length);
      await this.yieldFrame();
    }
    return { bytes: saved.size, changedSlices: ordered.length,
      mode: equalLength ? "positioned" : "stream",
      verified: true, untouchedRegionsTrusted: true };
  }
});
