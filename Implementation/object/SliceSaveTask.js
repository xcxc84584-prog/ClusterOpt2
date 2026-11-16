/**
 * Per-document cancellable writeback coordinator.
 *
 * Routed through HubUnit as an independent Object. A cancellation
 * request can run while the editor Object is busy waiting for disk.
 * The AbortSignal is deliberately not persisted in recovery data.
 */
export class SliceSaveTask {
  constructor(core) {
    this.id = "slice-save-task";
    this.core = core;
    this.tasks = new Map();
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    this.ocda = Object.freeze({
      Request: ["begin", "progress", "cancel", "finish", "state"],
      Response: ["begin", "progress", "cancel", "finish", "state"],
      UserAPI: ["cancel", "state"], AgentAPI: [],
      Property: [], Program: "SliceSaveTask",
      EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("SliceSaveTask registration failed");
    }
  }

  receive(action, payload = {}) {
    const { id } = payload;
    if (typeof id !== "string" || !id) {
      const error = new TypeError("Document identifier required");
      error.status = 400;
      throw error;
    }
    if (action === "begin") {
      if (this.tasks.has(id)) {
        const error = new Error("Save already running");
        error.status = 409;
        throw error;
      }
      const controller = new AbortController();
      const task = {
        controller, revision: payload.revision,
        percent: 0, phase: "writing"
      };
      this.tasks.set(id, task);
      return { signal: controller.signal };
    }
    const task = this.tasks.get(id);
    if (action === "state") {
      return task ? { active: true, percent: task.percent,
        phase: task.phase, revision: task.revision } :
        { active: false, percent: 0 };
    }
    if (action === "cancel") {
      if (!task) return false;
      task.phase = "cancelling";
      task.controller.abort();
      return true;
    }
    if (action === "progress") {
      if (!task) return false;
      task.percent = Math.max(task.percent,
        Math.min(99, Math.max(0, Math.floor(payload.percent ?? 0))));
      task.phase = payload.phase ?? "writing";
      return true;
    }
    if (action === "finish") {
      if (!task) return false;
      this.tasks.delete(id);
      return true;
    }
    const error = new TypeError("Unknown save task operation");
    error.status = 400;
    throw error;
  }
}
