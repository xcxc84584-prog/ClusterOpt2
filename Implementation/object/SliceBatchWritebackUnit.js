/**
 * Trusted MVCC batch commit. It loads each durable journal through
 * HubUnit, validates revisions, commits all edits using one writable
 * stream, and retires checkpoints only after disk readback.
 */
export class SliceBatchWritebackUnit {
  constructor(core) {
    this.id = "slice-batch-writeback-unit";
    this.core = core;
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    this.ocda = Object.freeze({
      Request: ["commit"], Response: ["commit"],
      UserAPI: [], AgentAPI: [],
      Property: ["SliceBatchWritePolicy"],
      Program: "SliceBatchWritebackUnit",
      EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("Batch writeback registration failed");
    }
  }

  async receive(action, payload = {}) {
    if (action !== "commit" || !Array.isArray(payload.edits) ||
        !payload.edits.length) {
      const error = new TypeError("Invalid batch commit");
      error.status = 400;
      throw error;
    }
    const edits = [];
    const sealed = [];
    for (const segment of payload.edits) {
      const result = await this.core.request(this.id,
        "slice-recovery-journal", "restore", { id: segment.id });
      if (!result.ok) {
        const error = new Error(result.error);
        error.status = result.status;
        throw error;
      }
      const entry = result.value;
      if (entry.revision !== segment.revision) {
        const error = new Error("Stale journal page revision");
        error.status = 409;
        throw error;
      }
      sealed.push(entry);
      edits.push({ ...segment, text: entry.text });
    }
    edits.sort((a, b) => a.start - b.start);
    const policy = this.core.readProperty(this.id,
      "SliceBatchWritePolicy");
    if (!policy.ok) {
      const error = new Error("Batch write Property unavailable");
      error.status = policy.status;
      throw error;
    }
    const receipt = await policy.value.commit(payload.handle,
      payload, edits);
    // Never retire the journal before verified disk writeback.
    for (const entry of sealed) {
      const result = await this.core.request(this.id,
        "slice-recovery-journal", "retire", {
          id: entry.id, revision: entry.revision,
          checksum: entry.checksum
        });
      if (!result.ok) {
        const error = new Error("File committed; journal retire failed");
        error.status = result.status;
        throw error;
      }
    }
    return { ...receipt, revisions: sealed.map(entry => ({
      id: entry.id, revision: entry.revision
    })) };
  }
}
