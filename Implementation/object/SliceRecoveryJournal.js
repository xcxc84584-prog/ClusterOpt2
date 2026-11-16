import { IndexedDBSliceJournalStore } from
  "./IndexedDBSliceJournalStore.js";

/**
 * Hub-routed durable slice checkpoints. No authority to write file data.
 * Persist is restricted to the transaction Object; restore is read-only.
 */
export class SliceRecoveryJournal {
  constructor(core, store = new IndexedDBSliceJournalStore()) {
    this.id = "slice-recovery-journal";
    this.core = core;
    this.store = store;
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    const actions = ["persist", "restore", "discard"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions,
      UserAPI: ["restore"], AgentAPI: [],
      Property: ["SliceJournalPolicy"],
      Program: "SliceRecoveryJournal",
      EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("SliceRecoveryJournal registration failed");
    }
  }

  policy() {
    return this.core.readProperty(this.id, "SliceJournalPolicy").value;
  }

  async receive(action, payload = {}) {
    const policy = this.policy();
    if (action === "persist") {
      const { id, revision, text } = payload;
      const entry = await policy.seal(id, revision, text);
      const prior = await this.store.get(id);
      if (prior) {
        await policy.verify(prior);
        if (revision <= prior.revision) {
          const error = new Error("Non-increasing journal revision");
          error.status = 409;
          throw error;
        }
      }
      // IndexedDB transaction completion is the durability boundary.
      await this.store.putIfNewer(entry);
      return { id, revision, checksum: entry.checksum };
    }
    if (action === "restore") {
      policy.validate(payload.id, 0, "");
      const entry = await this.store.get(payload.id);
      if (!entry) {
        const error = new Error("Missing slice journal checkpoint");
        error.status = 404;
        throw error;
      }
      return policy.verify(entry);
    }
    if (action === "discard") {
      policy.validate(payload.id, 0, "");
      // Only the owner can discard after an independently verified
      // writeback; no User API exposes this operation.
      await this.store.delete(payload.id);
      return true;
    }
    const error = new TypeError("Unknown journal operation");
    error.status = 400;
    throw error;
  }
}
