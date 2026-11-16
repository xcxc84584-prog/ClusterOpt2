import { FileManagement } from "../property/FileManagement.js";

/**
 * Explorer is a black-box navigation object. Workspace owns documents.
 * Requests cross HubUnit; Explorer stores no file content or file handles.
 */
export class Explorer {
  constructor(core) {
    this.id = "explorer";
    this.core = core;
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    this.ocda = Object.freeze({
      Request: ["list", "create", "open", "activate"],
      Response: ["list", "create", "open", "activate"],
      UserAPI: ["list", "create", "open", "activate"],
      AgentAPI: [],
      Property: ["FileManagement"],
      Program: "Explorer",
      EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("Explorer registration failed");
    }
  }

  async receive(action, payload = {}) {
    if (action === "list") {
      const result = await this.core.request(this.id, "workspace", "list");
      if (!result.ok) {
        const error = new Error(result.error);
        error.status = result.status;
        throw error;
      }
      return FileManagement.filter(result.value, payload.query);
    }
    const forwarded = {
      create: "new", open: "open", activate: "activate"
    }[action];
    if (!forwarded) {
      const error = new TypeError("Unsupported Explorer action");
      error.status = 400;
      throw error;
    }
    const result = await this.core.request(
      this.id, "workspace", forwarded, payload);
    if (!result.ok) {
      const error = new Error(result.error);
      error.status = result.status;
      throw error;
    }
    return result.value;
  }
}
