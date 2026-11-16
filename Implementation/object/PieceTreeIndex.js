import { PieceTreePolicy } from "../property/PieceTreePolicy.js";
import { BPlusSliceIndex } from "../property/BPlusSliceIndex.js";

/**
 * OCDA black-box document index. Algorithms live in shared Properties.
 * This component is not yet connected to the main editor/file loader.
 */
export class PieceTreeIndex {
  constructor(core) {
    this.id = "piece-tree-index";
    this.core = core;
    this.root = null;
    this.index = null;
    this.revision = 0;
    this.seed = 0;
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    const actions = ["insert", "remove", "read", "locate", "info"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions, UserAPI: actions,
      AgentAPI: [], Property: ["PieceTreePolicy", "BPlusSliceIndex"],
      Program: "PieceTreeIndex", EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("PieceTreeIndex registration failed");
    }
  }

  property(name) {
    return this.core.readProperty(this.id, name).value;
  }

  nextPriority() {
    // Deterministic pseudo-random priorities for reproducible tests.
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed;
  }

  validateRevision(payload) {
    if (payload.revision !== undefined &&
        payload.revision !== this.revision) {
      const error = new Error("Stale document revision");
      error.status = 409;
      throw error;
    }
  }

  async receive(action, payload = {}) {
    const tree = this.property("PieceTreePolicy");
    const indexPolicy = this.property("BPlusSliceIndex");
    try {
      if (action === "insert" || action === "remove") {
        this.validateRevision(payload);
        const priority = () => this.nextPriority();
        const candidate = action === "insert"
          ? tree.insert(this.root, payload.offset, payload.text, priority)
          : tree.remove(this.root, payload.start, payload.end, priority);
        this.root = candidate;
        this.index = null;
        this.revision++;
        return { length: tree.length(this.root),
          revision: this.revision };
      }
      if (action === "read") {
        return tree.read(this.root, payload.start, payload.end);
      }
      if (action === "locate") {
        if (!this.index) {
          this.index = indexPolicy.build(tree.pieces(this.root));
        }
        return indexPolicy.seek(this.index, payload.offset);
      }
      if (action === "info") {
        return { length: tree.length(this.root),
          revision: this.revision, indexed: this.index !== null };
      }
    } catch (error) {
      if (error instanceof RangeError || error instanceof TypeError) {
        error.status = 400;
      }
      throw error;
    }
    const error = new TypeError("Unknown piece-tree operation");
    error.status = 400;
    throw error;
  }
}
