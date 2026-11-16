/**
 * OCDA workbench tool-window lifecycle. File bytes and document
 * recovery remain owned exclusively by FileWorkspace.
 */
export class ToolTabManager {
  constructor(core) {
    this.id = "tool-tab-manager";
    this.core = core;
    this.opened = false;
    this.active = false;
    this.position = 0;
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    const actions = ["open", "activate", "deactivate", "close",
      "move", "restore", "list"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions, UserAPI: actions,
      AgentAPI: [], Property: ["ToolTabPolicy"],
      Program: "ToolTabManager", EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("ToolTabManager registration failed");
    }
  }

  policy() {
    return this.core.readProperty(this.id, "ToolTabPolicy").value;
  }

  snapshot() {
    return {
      id: this.policy().pluginId, open: this.opened,
      active: this.active, position: this.position
    };
  }

  async receive(action, payload = {}) {
    if (action === "list") return this.snapshot();
    if (action === "restore") {
      const state = payload.state;
      if (!state || typeof state.open !== "boolean" ||
          typeof state.active !== "boolean" ||
          (state.active && !state.open)) {
        return this.failure(400, "Invalid tool recovery state");
      }
      const count = payload.documentCount;
      const position = this.policy().validIndex(
        state.position, count);
      this.opened = state.open;
      this.active = state.active;
      this.position = this.opened ? position : 0;
      return this.snapshot();
    }
    if (action === "open") {
      if (!this.opened) {
        this.position = this.policy().validIndex(
          payload.index ?? 0, payload.documentCount ?? 0);
      }
      this.opened = true;
      this.active = true;
      return this.snapshot();
    }
    if (action === "activate") {
      if (!this.opened) return this.failure(404, "Tool tab is not open");
      this.active = true;
      return this.snapshot();
    }
    if (action === "deactivate") {
      this.active = false;
      return this.snapshot();
    }
    if (action === "close") {
      this.opened = false;
      this.active = false;
      this.position = 0;
      return this.snapshot();
    }
    if (action === "move") {
      if (!this.opened) return this.failure(404, "Tool tab is not open");
      this.position = this.policy().validIndex(
        payload.index, payload.documentCount);
      return this.snapshot();
    }
    return this.failure(400, "Unknown tool tab action");
  }

  failure(status, message) {
    const error = new Error(message);
    error.status = status;
    throw error;
  }
}
