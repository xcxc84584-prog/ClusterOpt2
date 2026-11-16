import { Language } from "../property/Language.js";
import { FileDocument } from "./FileDocument.js";
import { DocumentStatus } from "../property/DocumentStatus.js";
import { StoragePriority } from "../property/StoragePriority.js";
import { FileManagement } from "../property/FileManagement.js";

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
      Request: ["new", "open", "activate", "close", "closeAll",
        "reorder", "save", "setPriority", "syncExternal", "list"],
      Response: ["new", "open", "activate", "close", "closeAll",
        "reorder", "save", "setPriority", "syncExternal"],
      UserAPI: ["new", "open", "activate", "close", "closeAll",
        "reorder", "save", "setPriority", "syncExternal"],
      AgentAPI: [],
      Property: ["DocumentStatus", "StoragePriority", "FileManagement"],
      Program: "FileWorkspace",
      EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
    if (!core.register(this)) throw new Error("Workspace registration failed");
    this.restorePriority();
  }

  get active() {
    return this.documents.find(doc => doc.id === this.activeId) ?? null;
  }

  async receive(action, payload = {}) {
    if (action === "list") return FileManagement.summarize(this.documents);
    if (action === "new") return this.create();
    if (action === "open") return this.open(payload.handles);
    if (action === "activate") return this.activate(payload.id);
    if (action === "close") return this.close(payload.id);
    if (action === "closeAll") return this.closeAll();
    if (action === "reorder") return this.reorder(payload.from, payload.to);
    if (action === "setPriority") return this.setPriority(payload.priority);
    if (action === "syncExternal") return this.syncExternal();
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
    const created = [];
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
      created.push(doc);
      this.activeId = doc.id;
      this.onChange();
    }
    // I/O of independent files can overlap; HubUnit enforces per-file FIFO.
    const results = await Promise.all(created.map(doc =>
      this.core.request(this.id, doc.id, "load", {
        onProgress: () => this.onChange()
      })
    ));
    this.onChange();
    const failure = results.find(result => !result.ok);
    if (failure) throw new Error(failure.error);
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
        !window.confirm(Language.translate(
          this.core.readProperty(this.id, "Language").value,
          "confirmClose", { name: doc.name }))) {
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

  /** One confirmation protects all unsaved documents as one operation. */
  closeAll() {
    const dirty = this.documents.filter(doc =>
      doc.status !== DocumentStatus.SYNCED);
    if (dirty.length && !window.confirm(Language.translate(
      this.core.readProperty(this.id, "Language").value,
      "confirmCloseAll", { count: dirty.length }))) {
      return false;
    }
    for (const doc of this.documents) this.core.unregister(doc.id);
    this.documents = [];
    this.activeId = null;
    this.onChange();
    return true;
  }

  /** Preserve document identity and active selection while reordering. */
  reorder(from, to) {
    if (!Number.isInteger(from) || !Number.isInteger(to) ||
        from < 0 || to < 0 ||
        from >= this.documents.length || to >= this.documents.length) {
      const error = new RangeError("Invalid tab order index");
      error.status = 400;
      throw error;
    }
    if (from === to) return true;
    const [document] = this.documents.splice(from, 1);
    this.documents.splice(to, 0, document);
    this.onChange();
    return true;
  }

  restorePriority() {
    try {
      const saved = globalThis.window?.localStorage?.getItem(
        StoragePriority.storageKey);
      if (StoragePriority.valid(saved)) {
        this.core.hub.publishProperty("StoragePriority", saved);
      }
    } catch {
      this.core.omu.record("EHU", this.id, "Priority.Restore",
        503, "StoragePriority");
    }
  }

  setPriority(priority) {
    if (!StoragePriority.valid(priority)) {
      const error = new TypeError("Unknown StoragePriority");
      error.status = 400;
      throw error;
    }
    const result = this.core.hub.publishProperty("StoragePriority", priority);
    if (!result.ok) throw new Error("Cannot publish StoragePriority");
    try {
      globalThis.window?.localStorage?.setItem(
        StoragePriority.storageKey, priority);
    } catch {
      this.core.omu.record("EHU", this.id, "Priority.Persist",
        503, "StoragePriority");
    }
    this.onChange();
    return priority;
  }

  async syncExternal() {
    const priority = this.core.readProperty(this.id, "StoragePriority").value;
    const results = await Promise.all(this.documents.map(async doc => {
      if (!doc.handle || doc.status === DocumentStatus.LOADING) return null;
      return this.core.request(this.id, doc.id, "reconcile", {
        priority, onProgress: () => this.onChange()
      });
    }));
    this.onChange();
    return results;
  }

  async save(handle = null) {
    const doc = this.active;
    if (!doc) return false;
    const priority = this.core.readProperty(this.id, "StoragePriority").value;
    if (!handle && doc.handle) {
      const check = await this.core.request(this.id, doc.id, "reconcile", {
        priority, onProgress: () => this.onChange()
      });
      if (!check.ok) throw new Error(check.error);
      if (check.value && priority === StoragePriority.EXTERNAL) {
        this.onChange();
        return false;
      }
    }
    const result = await this.core.request(this.id, doc.id, "save", {
      handle,
      onProgress: () => this.onChange()
    });
    this.onChange();
    if (!result.ok) throw new Error(result.error);
    return true;
  }
}
