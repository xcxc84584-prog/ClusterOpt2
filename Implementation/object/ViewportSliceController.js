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
    const actions = ["open", "close", "navigate", "navigateBytes",
      "navigateLines", "navigateViewport", "describe"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions, UserAPI: actions,
      AgentAPI: [], Property: ["ViewportSlicePolicy", "ViewportLinePolicy"],
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
      const indexed = await this.core.request(this.id,
        "virtual-line-index", "open", payload);
      if (!indexed.ok) {
        // Roll back a loader-only open; the document is not usable.
        await this.call("slice-loader", "close", { id: data.id });
        const error = new Error(indexed.error);
        error.status = indexed.status;
        throw error;
      }
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
    if (action === "close") {
      // Loader refuses to discard any unsaved dirty slice (409).
      await this.call("slice-loader", "close", { id: document.id });
      await this.call("virtual-line-index", "close", {
        id: document.id
      });
      this.documents.delete(document.id);
      return true;
    }
    if (action === "describe") {
      return { ...document, full: [...document.full],
        preloaded: [...document.preloaded] };
    }
    if (!["navigate", "navigateBytes", "navigateLines",
      "navigateViewport"].includes(action)) {
      const error = new Error("Unknown viewport operation");
      error.status = 400;
      throw error;
    }
    let plan;
    let lines = null;
    if (action === "navigateViewport") {
      const geometry = this.core.readProperty(this.id,
        "ViewportLinePolicy").value;
      lines = geometry.range(payload);
    }
    if (action === "navigateLines" || lines) {
      const address = await this.call("virtual-line-index", "range", {
        id: document.id, firstLine: lines?.firstLine ?? payload.firstLine,
        lastLine: lines?.lastLine ?? payload.lastLine
      });
      plan = this.policy().bytePlan(document.byteLength,
        document.chunkBytes, address.start, address.end,
        payload.adjacent ?? 1);
    } else if (action === "navigateBytes") {
      plan = this.policy().bytePlan(document.byteLength,
        document.chunkBytes, payload.start, payload.end,
        payload.adjacent ?? 1);
    } else {
      plan = this.policy().plan(document.count,
        payload.first, payload.last, payload.adjacent ?? 1);
    }
    const sliceId = index => document.id + "-slice-" + index;
    // Drop stale visibility so offscreen clean slices can be evicted.
    await this.call("slice-registry", "setViewport", { ids: [] });
    const prior = await this.call("slice-registry", "list", {});
    const byId = new Map(prior.entries.map(item => [item.id, item]));
    const visible = [];
    for (const index of plan.full) {
      const previous = byId.get(sliceId(index));
      if (previous?.dirty && previous.state !== "full") {
        const error = new Error("Dirty slice must remain fully loaded");
        error.status = 409;
        throw error;
      }
      if (previous?.state !== "full") {
        await this.call("slice-loader", "load", {
          id: document.id, index, mode: "full"
        });
      }
      visible.push(sliceId(index));
      await this.call("slice-registry", "setViewport", {
        ids: [...visible]
      });
    }
    const preloaded = [];
    for (const index of plan.preloaded) {
      const previous = byId.get(sliceId(index));
      if (previous?.dirty) continue;
      if (previous?.state === "preloaded") {
        preloaded.push(index);
        continue;
      }
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
      if (keep.has(entry.id) || entry.dirty ||
          entry.state === "virtual") continue;
      await this.call("slice-registry", "demote", { id: entry.id });
    }
    document.full = [...plan.full];
    document.preloaded = [...preloaded];
    return { id: document.id, full: [...document.full],
      preloaded: [...document.preloaded], ...(lines ? { lines } : {}) };
  }
}
