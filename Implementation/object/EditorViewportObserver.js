/**
 * Read-only browser viewport bridge. The legacy editor remains the only
 * editing authority until transactional Piece Tree writeback is available.
 * All virtual-document traffic is routed through HubUnit.
 */
export class EditorViewportObserver {
  constructor(core) {
    this.id = "editor-viewport-observer";
    this.core = core;
    this.activeId = null;
    this.lastGeometry = null;
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    const actions = ["attach", "navigate", "detach", "describe"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions, UserAPI: actions,
      AgentAPI: [], Property: ["ViewportLinePolicy"],
      Program: "EditorViewportObserver",
      EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("EditorViewportObserver registration failed");
    }
  }

  async call(action, payload) {
    const result = await this.core.request(this.id,
      "viewport-slices", action, payload);
    if (!result.ok) {
      const error = new Error(result.error);
      error.status = result.status;
      throw error;
    }
    return result.value;
  }

  async detach() {
    if (!this.activeId) return true;
    // Never discard a dirty virtual slice when the controller rejects it.
    await this.call("close", { id: this.activeId });
    this.activeId = null;
    this.lastGeometry = null;
    return true;
  }

  async receive(action, payload = {}) {
    if (action === "describe") {
      return { activeId: this.activeId,
        geometry: this.lastGeometry && { ...this.lastGeometry } };
    }
    if (action === "detach") return this.detach();

    if (action === "attach") {
      if (typeof payload.id !== "string" ||
          !(payload.blob instanceof Blob)) {
        const error = new TypeError("Valid Blob and ID required");
        error.status = 400;
        throw error;
      }
      if (this.activeId === payload.id) return { id: this.activeId };
      await this.detach();
      await this.call("open", {
        id: payload.id, blob: payload.blob
      });
      this.activeId = payload.id;
      return { id: this.activeId };
    }

    if (action === "navigate") {
      if (!this.activeId || payload.id !== this.activeId) {
        const error = new Error("No matching observed document");
        error.status = 409;
        throw error;
      }
      // The observer is strictly read-only. Any edit invalidates its
      // snapshot, even if the editor later becomes clean after saving.
      if (payload.dirty !== false) {
        const error = new Error("Dirty document cannot be observed");
        error.status = 409;
        throw error;
      }
      const geometry = {
        scrollTop: payload.scrollTop,
        clientHeight: payload.clientHeight,
        lineHeight: payload.lineHeight,
        adjacent: payload.adjacent ?? 1,
        maxLine: payload.maxLine
      };
      const result = await this.call("navigateViewport", {
        ...geometry, id: this.activeId
      });
      this.lastGeometry = { ...geometry };
      return result;
    }
    const error = new Error("Unknown viewport observer action");
    error.status = 400;
    throw error;
  }
}
