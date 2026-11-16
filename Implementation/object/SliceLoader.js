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
    const actions = ["open", "load", "describe"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions, UserAPI: actions,
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

  async receive(action, payload = {}) {
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
    if (action === "describe") {
      return this.describe(this.document(payload.id));
    }
    if (action === "load") {
      const document = this.document(payload.id);
      const { index, mode } = payload;
      if (mode !== "full" && mode !== "preloaded") {
        const error = new TypeError("Invalid loading mode");
        error.status = 400;
        throw error;
      }
      const range = this.validate(() => this.policy().range(
        document.blob.size, index, document.chunkBytes));
      const sliceId = document.id + "-slice-" + index;
      const { start, end, text } = await this.policy().read(
        document.blob, index, document.chunkBytes);
      // A binary-invalid or zero-length decoded range is not resident.
      if (start >= end) {
        const error = new TypeError("Empty UTF-8 slice");
        error.status = 422;
        throw error;
      }
      if (!document.registered.has(index)) {
        const registration = await this.core.request(this.id,
          "slice-registry", "registerVirtual", {
            id: sliceId, start: range.start, end: range.end
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
    const error = new TypeError("Unknown loader operation");
    error.status = 400;
    throw error;
  }
}
