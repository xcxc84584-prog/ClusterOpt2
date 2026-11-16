/**
 * PR8 Stage-2 virtual slice registry. Does not read whole files or
 * perform disk I/O. Slice content is supplied by a future loader.
 */
export class SliceRegistry {
  constructor(core, storage = undefined) {
    this.id = "slice-registry";
    this.core = core;
    this.entries = new Map();
    this.visibleIds = new Set();
    this.generation = 0;
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    const actions = ["registerVirtual", "release", "load", "demote",
      "markDirty", "setViewport", "setLimit", "read", "list"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions, UserAPI: actions,
      AgentAPI: [], Property: ["SliceBudgetPolicy"],
      Program: "SliceRegistry", EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("SliceRegistry registration failed");
    }
    this.limitBytes = this.policy().defaultBytes;
    this.storage = null;
    try {
      this.storage = storage === undefined ? globalThis.localStorage : storage;
      const raw = this.storage?.getItem("clusteropt2.slice.limit.v1");
      if (raw !== null && raw !== undefined) {
        this.limitBytes = this.policy().validateLimit(JSON.parse(raw));
      }
    } catch (error) {
      this.core.omu.record("EHU", this.id, "SliceLimit.Restore",
        503, "storage", { error: String(error) });
    }
  }

  policy() {
    return this.core.readProperty(this.id, "SliceBudgetPolicy").value;
  }

  find(id) {
    const entry = this.entries.get(id);
    if (entry) return entry;
    const error = new Error("Unknown slice");
    error.status = 404;
    throw error;
  }

  state(entry) {
    const { id, start, end, state, residentBytes, dirty } = entry;
    return { id, start, end, state, residentBytes, dirty };
  }

  async receive(action, payload = {}) {
    const policy = this.policy();
    if (action === "registerVirtual") {
      const { id, start, end } = payload;
      if (typeof id !== "string" || !id || id.length > 128 ||
          !Number.isSafeInteger(start) || start < 0 ||
          !Number.isSafeInteger(end) || end <= start) {
        const error = new TypeError("Invalid virtual slice descriptor");
        error.status = 400;
        throw error;
      }
      if (this.entries.has(id)) {
        const error = new Error("Slice already registered");
        error.status = 409;
        throw error;
      }
      const entry = {
        id, start, end, state: policy.states.VIRTUAL,
        content: null, residentBytes: 0, dirty: false,
        lastUsed: ++this.generation
      };
      this.entries.set(id, entry);
      return this.state(entry);
    }
    if (action === "release") {
      const entry = this.find(payload.id);
      if (entry.dirty) {
        const error = new Error("Dirty slice must be saved before release");
        error.status = 409;
        throw error;
      }
      // Explicit close removes both residency and virtual metadata.
      this.visibleIds.delete(entry.id);
      this.entries.delete(entry.id);
      return true;
    }
    if (action === "setViewport") {
      if (!Array.isArray(payload.ids) ||
          payload.ids.some(id => !this.entries.has(id))) {
        const error = new TypeError("Invalid viewport slice set");
        error.status = 400;
        throw error;
      }
      this.visibleIds = new Set(payload.ids);
      return true;
    }
    if (action === "setLimit") {
      const limit = policy.validateLimit(payload.bytes);
      const evictions = policy.evictions(
        [...this.entries.values()], "", 0, limit, this.visibleIds);
      for (const id of evictions) this.clear(this.find(id));
      this.limitBytes = limit;
      try {
        this.storage?.setItem("clusteropt2.slice.limit.v1",
          JSON.stringify(limit));
      } catch (error) {
        this.core.omu.record("EHU", this.id, "SliceLimit.Persist",
          503, "storage", { error: String(error) });
      }
      return { bytes: limit };
    }
    if (action === "load") {
      const entry = this.find(payload.id);
      if (!["preloaded", "full"].includes(payload.mode)) {
        const error = new TypeError("Invalid loaded slice mode");
        error.status = 400;
        throw error;
      }
      if (entry.dirty) {
        const error = new Error("Dirty slice requires writeback");
        error.status = 409;
        throw error;
      }
      const bytes = policy.measure(payload.text);
      const evictions = policy.evictions(
        [...this.entries.values()], entry.id, bytes,
        this.limitBytes, this.visibleIds);
      for (const id of evictions) this.clear(this.find(id));
      entry.content = payload.text;
      entry.residentBytes = bytes;
      entry.state = payload.mode;
      entry.lastUsed = ++this.generation;
      return this.state(entry);
    }
    if (action === "markDirty") {
      const entry = this.find(payload.id);
      if (entry.state !== policy.states.FULL) {
        const error = new Error("Only fully loaded slices can be dirty");
        error.status = 409;
        throw error;
      }
      entry.dirty = true;
      return this.state(entry);
    }
    if (action === "demote") {
      const entry = this.find(payload.id);
      if (entry.dirty) {
        const error = new Error("Dirty slice cannot be evicted");
        error.status = 409;
        throw error;
      }
      this.clear(entry);
      return this.state(entry);
    }
    if (action === "read") {
      const entry = this.find(payload.id);
      if (entry.state !== policy.states.FULL) {
        const error = new Error("Slice is not fully loaded");
        error.status = 409;
        throw error;
      }
      entry.lastUsed = ++this.generation;
      return entry.content;
    }
    if (action === "list") {
      return {
        limitBytes: this.limitBytes,
        entries: [...this.entries.values()].map(entry =>
          this.state(entry))
      };
    }
    const error = new TypeError("Unknown slice operation");
    error.status = 400;
    throw error;
  }

  clear(entry) {
    entry.content = null;
    entry.residentBytes = 0;
    entry.state = this.policy().states.VIRTUAL;
  }
}
