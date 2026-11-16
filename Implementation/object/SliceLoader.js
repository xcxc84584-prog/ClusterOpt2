/**
 * Isolated Blob-backed virtual document loader.
 * A document retains its Blob handle, not a complete decoded string.
 * Registry operations cross the OCDA Hub and retain budget protections.
 */
export class SliceLoader {
  constructor(core) {
    this.id = "slice-loader";
    this.core = core;
    this.documents = new Map();
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    const actions = ["open", "load", "loadBatch", "close", "describe"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions,
      UserAPI: actions.filter(name => name !== "close"),
      AgentAPI: [], Property: ["UTF8SlicePolicy"],
      Program: "SliceLoader", EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("SliceLoader registration failed");
    }
  }

  policy() {
    return this.core.readProperty(this.id, "UTF8SlicePolicy").value;
  }

  document(id) {
    const document = this.documents.get(id);
    if (document) return document;
    const error = new Error("Unknown virtual document");
    error.status = 404;
    throw error;
  }

  describe(document) {
    return {
      id: document.id,
      byteLength: document.blob.size,
      chunkBytes: document.chunkBytes,
      count: this.policy().count(document.blob.size,
        document.chunkBytes)
    };
  }

  validate(run) {
    try {
      return run();
    } catch (error) {
      if (error instanceof RangeError || error instanceof TypeError) {
        error.status ??= 400;
      }
      throw error;
    }
  }


  async commitRead(document, index, mode, read) {
    const { start, end, text } = read;
    if (start >= end) {
      const error = new TypeError("Empty UTF-8 slice");
      error.status = 422;
      throw error;
    }
    const sliceId = document.id + "-slice-" + index;
    if (!document.registered.has(index)) {
      const registration = await this.core.request(this.id,
        "slice-registry", "registerVirtual", {
          id: sliceId, start, end
        });
      if (!registration.ok) {
        const error = new Error(registration.error);
        error.status = registration.status;
        throw error;
      }
      document.registered.add(index);
    }
    const loaded = await this.core.request(this.id,
      "slice-registry", "load", { id: sliceId, mode, text });
    if (!loaded.ok) {
      const error = new Error(loaded.error);
      error.status = loaded.status;
      throw error;
    }
    return { ...loaded.value, byteStart: start, byteEnd: end };
  }

  /**
   * Read at most four independent Blob chunks concurrently. Commit
   * in input order so the registry's memory budget stays authoritative.
   * Only speculative preload budget refusals are nonfatal.
   */
  async loadBatch(payload) {
    const document = this.document(payload.id);
    const indices = payload.indices;
    const mode = payload.mode;
    if (!Array.isArray(indices) || indices.length < 1 ||
        indices.length > 4 || new Set(indices).size !== indices.length ||
        !["full", "preloaded"].includes(mode)) {
      const error = new RangeError("Invalid bounded slice batch");
      error.status = 400;
      throw error;
    }
    for (const index of indices) {
      this.validate(() => this.policy().range(
        document.blob.size, index, document.chunkBytes));
    }
    if (payload.signal?.aborted) {
      const error = new Error("Slice batch aborted");
      error.name = "AbortError";
      error.status = 409;
      throw error;
    }
    const decoded = await Promise.all(indices.map(index =>
      this.policy().read(document.blob, index, document.chunkBytes)));
    const loaded = [];
    const skipped = [];
    for (let i = 0; i < indices.length; i++) {
      if (payload.signal?.aborted) {
        const error = new Error("Slice batch aborted");
        error.name = "AbortError";
        error.status = 409;
        throw error;
      }
      try {
        await this.commitRead(document, indices[i], mode, decoded[i]);
        loaded.push(indices[i]);
      } catch (error) {
        if (mode !== "preloaded" || error.status !== 413) throw error;
        skipped.push(indices[i]);
      }
    }
    return { id: document.id, loaded, skipped };
  }

  async receive(action, payload = {}) {
    if (action === "loadBatch") return this.loadBatch(payload);
    if (action === "open") {
      const { id, blob } = payload;
      if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) ||
          !(blob instanceof Blob)) {
        const error = new TypeError("Invalid Blob document");
        error.status = 400;
        throw error;
      }
      if (this.documents.has(id)) {
        const error = new Error("Document already open");
        error.status = 409;
        throw error;
      }
      const chunkBytes = this.validate(() => this.policy().chunkBytes(
        payload.chunkBytes ?? this.policy().defaultChunkBytes));
      const document = { id, blob, chunkBytes, registered: new Set() };
      this.documents.set(id, document);
      return this.describe(document);
    }
    if (action === "close") {
      const document = this.document(payload.id);
      const snapshot = await this.core.request(this.id,
        "slice-registry", "list");
      if (!snapshot.ok) {
        const error = new Error(snapshot.error);
        error.status = snapshot.status;
        throw error;
      }
      const ids = [...document.registered].map(index =>
        document.id + "-slice-" + index);
      const owned = new Set(ids);
      if (snapshot.value.entries.some(entry =>
        owned.has(entry.id) && entry.dirty)) {
        const error = new Error("Dirty slices require durable writeback");
        error.status = 409;
        throw error;
      }
      for (const index of [...document.registered]) {
        const id = document.id + "-slice-" + index;
        const release = await this.core.request(this.id,
          "slice-registry", "release", { id });
        if (!release.ok && release.status !== 404) {
          const error = new Error(release.error);
          error.status = release.status;
          throw error;
        }
        document.registered.delete(index);
      }
      this.documents.delete(document.id);
      return true;
    }
    if (action === "describe") {
      return this.describe(this.document(payload.id));
    }
    if (action === "load") {
      const document = this.document(payload.id);
      const { index, mode } = payload;
      if (!["full", "preloaded"].includes(mode)) {
        const error = new TypeError("Invalid loading mode");
        error.status = 400;
        throw error;
      }
      this.validate(() => this.policy().range(
        document.blob.size, index, document.chunkBytes));
      const decoded = await this.policy().read(
        document.blob, index, document.chunkBytes);
      return this.commitRead(document, index, mode, decoded);
    }
    const error = new TypeError("Unknown loader operation");
    error.status = 400;
    throw error;
  }
}
