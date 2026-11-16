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
    const actions = ["open", "transact", "read", "locate",
      "info", "close"];
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
      dirty: item.dirty
    };
  }

  async receive(action, payload = {}) {
    const policy = this.property("SliceTransactionPolicy");
    const tree = this.property("PieceTreePolicy");

    if (action === "open") {
      const id = policy.checkId(payload.id);
      const text = policy.checkText(payload.text);
      if (this.slices.has(id)) {
        const error = new Error("Edit slice already open");
        error.status = 409;
        throw error;
      }
      const root = text ? tree.insert(null, 0, text, () => 1) : null;
      const item = { id, root, revision: 0, dirty: false,
        index: null, seed: 0 };
      this.slices.set(id, item);
      return this.describe(item);
    }

    const item = this.slice(payload.id);
    if (action === "info") return this.describe(item);

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

    if (action === "transact") {
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
      // All-or-nothing publication: errors leave old root/revision intact.
      item.root = candidate;
      item.seed = seed;
      item.revision++;
      item.dirty = true;
      item.index = null;
      return this.describe(item);
    }
    const error = new TypeError("Unknown slice transaction action");
    error.status = 400;
    throw error;
  }
}
