/**
 * OCDA sandbox for atomic per-slice edits. This is not disk persistence:
 * dirty roots cannot be closed until a future durable writeback unit
 * commits them. Other slices may be edited independently in this Object.
 */
export class SliceEditTransaction {
  constructor(core) {
    this.id = "slice-edit-transaction";
    this.core = core;
    this.slices = new Map();
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    const actions = ["open", "transact", "transactDurable",
      "restoreDurable", "commitWriteback", "finalizeBatch",
      "read", "locate", "info", "close"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions, UserAPI: actions,
      AgentAPI: [], Property: ["SliceTransactionPolicy",
        "PieceTreePolicy", "BPlusSliceIndex"],
      Program: "SliceEditTransaction",
      EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("SliceEditTransaction registration failed");
    }
  }

  property(name) {
    const result = this.core.readProperty(this.id, name);
    if (!result.ok) {
      const error = new Error("Property unavailable: " + name);
      error.status = result.status;
      throw error;
    }
    return result.value;
  }

  slice(id) {
    const item = this.slices.get(id);
    if (!item) {
      const error = new Error("Unknown edit slice");
      error.status = 404;
      throw error;
    }
    return item;
  }

  describe(item) {
    return {
      id: item.id, revision: item.revision,
      length: this.property("PieceTreePolicy").length(item.root),
      dirty: item.dirty, durable: item.durable
    };
  }

  async callJournal(action, payload) {
    const response = await this.core.request(this.id,
      "slice-recovery-journal", action, payload);
    if (!response.ok) {
      const error = new Error(response.error);
      error.status = response.status;
      throw error;
    }
    return response.value;
  }

  async receive(action, payload = {}) {
    const policy = this.property("SliceTransactionPolicy");
    const tree = this.property("PieceTreePolicy");

    if (action === "restoreDurable") {
      const id = policy.checkId(payload.id);
      if (this.slices.has(id)) {
        const error = new Error("Slice is already open");
        error.status = 409;
        throw error;
      }
      if (this.slices.size >= policy.maxOpenSlices) {
        const error = new Error("Too many open edit slices");
        error.status = 413;
        throw error;
      }
      const restored = await this.callJournal("restore", { id });
      policy.checkText(restored.text);
      const root = restored.text ?
        tree.insert(null, 0, restored.text, () => 1) : null;
      const item = {
        id, root, revision: restored.revision,
        dirty: true, durable: true, index: null, seed: 0
      };
      this.slices.set(id, item);
      return this.describe(item);
    }

    if (action === "open") {
      const id = policy.checkId(payload.id);
      const text = policy.checkText(payload.text);
      if (this.slices.has(id)) {
        const error = new Error("Edit slice already open");
        error.status = 409;
        throw error;
      }
      if (this.slices.size >= policy.maxOpenSlices) {
        const error = new RangeError("Too many open edit slices");
        error.status = 413;
        throw error;
      }
      const root = text ? tree.insert(null, 0, text, () => 1) : null;
      const item = { id, root, revision: 0, dirty: false,
        durable: false, index: null, seed: 0 };
      this.slices.set(id, item);
      return this.describe(item);
    }

    const item = this.slice(payload.id);
    if (action === "info") return this.describe(item);

    if (action === "finalizeBatch") {
      if (!item.dirty || !item.durable ||
          payload.revision !== item.revision) {
        const error = new Error("Stale batch finalize revision");
        error.status = 409;
        throw error;
      }
      // Batch coordinator already verified disk and retired the
      // matching journal. No disk I/O occurs in this transaction.
      item.dirty = false;
      item.durable = false;
      return this.describe(item);
    }

    if (action === "commitWriteback") {
      if (!item.dirty || !item.durable ||
          !Number.isSafeInteger(payload.revision) ||
          payload.revision !== item.revision) {
        const error = new Error("No matching durable dirty revision");
        error.status = 409;
        throw error;
      }
      // The on-disk stream and readback are performed by a separate
      // Hub-owned Object. No data is released before verification.
      const response = await this.core.request(this.id,
        "slice-writeback-unit", "commit", {
          ...payload, id: item.id, revision: item.revision
        });
      if (!response.ok) {
        const error = new Error(response.error);
        error.status = response.status;
        throw error;
      }
      item.dirty = false;
      item.durable = false;
      return { ...this.describe(item), receipt: response.value };
    }

    if (action === "close") {
      if (item.dirty) {
        const error = new Error("Dirty slice requires durable writeback");
        error.status = 409;
        throw error;
      }
      this.slices.delete(item.id);
      return true;
    }

    if (action === "read") {
      return tree.read(item.root, payload.start, payload.end);
    }

    if (action === "locate") {
      if (!item.index) {
        item.index = this.property("BPlusSliceIndex")
          .build(tree.pieces(item.root));
      }
      return this.property("BPlusSliceIndex")
        .seek(item.index, payload.offset);
    }

    if (action === "transact" || action === "transactDurable") {
      if (!Number.isSafeInteger(payload.revision) ||
          payload.revision !== item.revision) {
        const error = new Error("Stale slice MVCC revision");
        error.status = 409;
        throw error;
      }
      policy.checkOperations(payload.operations);
      let candidate = item.root;
      let seed = item.seed;
      const nextPriority = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed;
      };
      for (const operation of payload.operations) {
        candidate = policy.apply(tree, candidate,
          operation, nextPriority);
        if (tree.length(candidate) > policy.maxSliceUnits) {
          const error = new RangeError("Edited slice exceeds memory budget");
          error.status = 413;
          throw error;
        }
      }
      if (action === "transactDurable") {
        // Write a verified checkpoint before publishing the candidate.
        // A storage failure leaves the prior in-memory root intact.
        const text = tree.read(candidate, 0, tree.length(candidate));
        await this.callJournal("persist", {
          id: item.id, revision: item.revision + 1, text
        });
      }
      // All-or-nothing publication: errors leave old root/revision intact.
      item.root = candidate;
      item.seed = seed;
      item.revision++;
      item.dirty = true;
      item.durable = action === "transactDurable";
      item.index = null;
      return this.describe(item);
    }
    const error = new TypeError("Unknown slice transaction action");
    error.status = 400;
    throw error;
  }
}
