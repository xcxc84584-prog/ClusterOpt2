/**
 * Stage-2 viewport cache coordinator. Does not render or edit text.
 * Calls SliceLoader and SliceRegistry only through HubUnit.
 */
export class ViewportSliceController {
  constructor(core) {
    this.id = "viewport-slices";
    this.core = core;
    this.documents = new Map();
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    const actions = ["open", "navigate", "describe"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions, UserAPI: actions,
      AgentAPI: [], Property: ["ViewportSlicePolicy"],
      Program: "ViewportSliceController", EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("ViewportSliceController registration failed");
    }
  }

  policy() {
    return this.core.readProperty(this.id, "ViewportSlicePolicy").value;
  }

  async call(target, action, payload) {
    const response = await this.core.request(
      this.id, target, action, payload);
    if (!response.ok) {
      const error = new Error(response.error);
      error.status = response.status;
      throw error;
    }
    return response.value;
  }

  async receive(action, payload = {}) {
    if (action === "open") {
      const data = await this.call("slice-loader", "open", payload);
      this.documents.set(data.id, {
        ...data, full: [], preloaded: []
      });
      return { ...data };
    }
    const document = this.documents.get(payload.id);
    if (!document) {
      const error = new Error("Unknown viewport document");
      error.status = 404;
      throw error;
    }
    if (action === "describe") {
      return { ...document, full: [...document.full],
        preloaded: [...document.preloaded] };
    }
    if (action !== "navigate") {
      const error = new Error("Unknown viewport operation");
      error.status = 400;
      throw error;
    }
    const plan = this.policy().plan(document.count,
      payload.first, payload.last, payload.adjacent ?? 1);
    const sliceId = index => document.id + "-slice-" + index;
    // Drop stale visibility so offscreen clean slices can be evicted.
    await this.call("slice-registry", "setViewport", { ids: [] });
    const visible = [];
    for (const index of plan.full) {
      await this.call("slice-loader", "load", {
        id: document.id, index, mode: "full"
      });
      visible.push(sliceId(index));
      await this.call("slice-registry", "setViewport", {
        ids: [...visible]
      });
    }
    const preloaded = [];
    for (const index of plan.preloaded) {
      try {
        await this.call("slice-loader", "load", {
          id: document.id, index, mode: "preloaded"
        });
        preloaded.push(index);
      } catch (error) {
        // A low memory budget may omit speculative preloads; never
        // omit visible slices or swallow non-budget load failures.
        if (error.status !== 413) throw error;
      }
    }
    const snapshot = await this.call("slice-registry", "list", {});
    const keep = new Set([...plan.full, ...preloaded].map(sliceId));
    for (const entry of snapshot.entries) {
      if (!entry.id.startsWith(document.id + "-slice-") ||
          keep.has(entry.id) || entry.dirty ||
          entry.state === "virtual") continue;
      await this.call("slice-registry", "demote", { id: entry.id });
    }
    document.full = [...plan.full];
    document.preloaded = [...preloaded];
    return { id: document.id, full: [...document.full],
      preloaded: [...document.preloaded] };
  }
}
