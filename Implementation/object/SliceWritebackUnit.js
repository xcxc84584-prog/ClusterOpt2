/**
 * Trusted internal file writeback coordinator. It only accepts verified
 * immutable journal checkpoints, never unverified UI text or direct
 * UserAPI writes. FileDocument remains the production save authority.
 */
export class SliceWritebackUnit {
  constructor(core) {
    this.id = "slice-writeback-unit";
    this.core = core;
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    this.ocda = Object.freeze({
      Request: ["commit"], Response: ["commit"],
      UserAPI: [], AgentAPI: [],
      Property: ["SliceFileWritePolicy", "SliceJournalPolicy"],
      Program: "SliceWritebackUnit", EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("SliceWritebackUnit registration failed");
    }
  }

  property(name) {
    const value = this.core.readProperty(this.id, name);
    if (!value.ok) {
      const error = new Error("Writeback Property unavailable");
      error.status = value.status;
      throw error;
    }
    return value.value;
  }

  async receive(action, payload = {}) {
    if (action !== "commit") {
      const error = new TypeError("Unknown writeback operation");
      error.status = 400;
      throw error;
    }
    const journal = await this.core.request(this.id,
      "slice-recovery-journal", "restore", { id: payload.id });
    if (!journal.ok) {
      const error = new Error(journal.error);
      error.status = journal.status;
      throw error;
    }
    const entry = journal.value;
    if (entry.revision !== payload.revision) {
      const error = new Error("Journal revision is not the requested one");
      error.status = 409;
      throw error;
    }
    const policy = this.property("SliceFileWritePolicy");
    const receipt = await policy.commit(payload.handle, payload, entry.text);
    const retired = await this.core.request(this.id,
      "slice-recovery-journal", "retire", {
        id: entry.id, revision: entry.revision,
        checksum: entry.checksum
      });
    if (!retired.ok) {
      const error = new Error("Saved file; checkpoint retirement failed: " +
        retired.error);
      error.status = retired.status;
      throw error;
    }
    return { ...receipt, id: entry.id, revision: entry.revision,
      retainedJournal: false };
  }
}
