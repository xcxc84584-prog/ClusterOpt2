import { FileDocument } from "./FileDocument.js";
import { DocumentStatus } from "../property/DocumentStatus.js";

/** Workspace object owns the document collection and active tab. */
export class FileWorkspace {
  constructor(core, onChange) {
    this.id = "workspace";
    this.core = core;
    this.onChange = onChange;
    this.documents = [];
    this.activeId = null;
    this.authorization = Object.freeze({ default: "Public" });
    this.strictOCDA = true;
    this.ocda = Object.freeze({
      Request: ["new", "open", "activate", "close", "save"],
      Response: ["new", "open", "activate", "close", "save"],
      UserAPI: ["new", "open", "activate", "close", "save"],
      AgentAPI: [],
      Property: ["DocumentStatus"],
      Program: "FileWorkspace",
      EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
    if (!core.register(this)) throw new Error("Workspace registration failed");
  }

  get active() {
    return this.documents.find(doc => doc.id === this.activeId) ?? null;
  }

  async receive(action, payload = {}) {
    if (action === "new") return this.create();
    if (action === "open") return this.open(payload.handles);
    if (action === "activate") return this.activate(payload.id);
    if (action === "close") return this.close(payload.id);
    if (action === "save") return this.save(payload.handle);
    throw new Error("Unknown workspace action: " + action);
  }

  create() {
    const doc = new FileDocument();
    if (!this.core.register(doc)) throw new Error("Registration failed");
    this.documents.push(doc);
    this.activeId = doc.id;
    this.onChange();
    return doc.id;
  }

  async open(handles) {
    if (!Array.isArray(handles) || !handles.length) {
      throw new TypeError("Authorized file handles required");
    }
    for (const handle of handles) {
      let existing = null;
      for (const doc of this.documents) {
        if (doc.handle && typeof doc.handle.isSameEntry === "function" &&
            await doc.handle.isSameEntry(handle)) {
          existing = doc;
          break;
        }
      }
      if (existing) {
        this.activeId = existing.id;
        continue;
      }
      const doc = new FileDocument(handle.name, handle);
      if (!this.core.register(doc)) throw new Error("Registration failed");
      this.documents.push(doc);
      this.activeId = doc.id;
      this.onChange();
      const result = await this.core.request(this.id, doc.id, "load", {
        onProgress: () => this.onChange()
      });
      this.onChange();
      if (!result.ok) throw new Error(result.error);
    }
    this.onChange();
    return this.activeId;
  }

  activate(id) {
    if (!this.documents.some(doc => doc.id === id)) return false;
    this.activeId = id;
    this.onChange();
    return true;
  }

  close(id = this.activeId) {
    const index = this.documents.findIndex(doc => doc.id === id);
    if (index < 0) return false;
    const doc = this.documents[index];
    if (doc.status !== DocumentStatus.SYNCED &&
        !window.confirm("檔案尚未儲存，確定要關閉「" + doc.name + "」？")) {
      return false;
    }
    this.documents.splice(index, 1);
    this.core.unregister(id);
    if (this.activeId === id) {
      this.activeId = this.documents[Math.min(index,
        this.documents.length - 1)]?.id ?? null;
    }
    this.onChange();
    return true;
  }

  async save(handle = null) {
    const doc = this.active;
    if (!doc) return false;
    const result = await this.core.request(this.id, doc.id, "save", {
      handle,
      onProgress: () => this.onChange()
    });
    this.onChange();
    if (!result.ok) throw new Error(result.error);
    return true;
  }
}
