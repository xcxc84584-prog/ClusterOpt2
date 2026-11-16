import { Language } from "../property/Language.js";
import { FileDocument } from "./FileDocument.js";
import { VirtualFileDocument } from "./VirtualFileDocument.js";
import { DocumentStatus } from "../property/DocumentStatus.js";
import { StoragePriority } from "../property/StoragePriority.js";
import { FileManagement } from "../property/FileManagement.js";
import { RecoveryPolicy } from "../property/RecoveryPolicy.js";

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
      Request: ["new", "open", "page", "activate", "close", "closeAll",
        "reorder", "save", "setPriority", "syncExternal", "list",
        "entries", "snapshot", "restore", "closeMany"],
      Response: ["new", "open", "page", "activate", "close", "closeAll",
        "reorder", "save", "setPriority", "syncExternal"],
      UserAPI: ["new", "open", "page", "activate", "close", "closeAll",
        "reorder", "save", "setPriority", "syncExternal"],
      AgentAPI: [],
      Property: ["DocumentStatus", "StoragePriority", "FileManagement",
        "VirtualDocumentPolicy"],
      Program: "FileWorkspace",
      EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
    if (!core.register(this)) throw new Error("Workspace registration failed");
    this.restorePriority();
  }

  snapshot() {
    return {
      activeId: this.activeId,
      documents: this.documents.map(doc => ({
        id: doc.id, name: doc.name,
        text: doc.virtualReadOnly ? "" : doc.text,
        handle: doc.handle, status: doc.status,
        cursor: doc.cursor, scrollTop: doc.scrollTop,
        revision: doc.revision, diskRevision: doc.diskRevision,
        lineEnding: doc.lineEnding, hasUtf8Bom: doc.hasUtf8Bom,
        virtual: Boolean(doc.virtualReadOnly),
        virtualPageIndex: doc.virtualPageIndex ?? 0,
        virtualEdit: doc.pendingRecovery ??
          (doc.virtualReadOnly &&
          doc.status === DocumentStatus.DIRTY ? {
            id: doc.editSliceId, revision: doc.editRevision,
            fingerprint: doc.fileFingerprint,
            sourceHash: doc.sourceHash,
            index: doc.virtualPageIndex,
            start: doc.pageStart, end: doc.pageEnd
          } : null)
      }))
    };
  }

  restoreSnapshot(snapshot) {
    if (this.documents.length || !Array.isArray(snapshot?.documents) ||
        snapshot.documents.length > RecoveryPolicy.maxDocuments ||
        !snapshot.documents.every(item =>
          RecoveryPolicy.isDocument(item))) {
      const error = new Error("Unsafe or duplicate workspace restore");
      error.status = 409;
      throw error;
    }
    const restored = [];
    const ids = new Map();
    try {
      for (const state of snapshot.documents) {
        // Never restore a page preview as if it were a whole file.
        if (state.virtual && !state.handle) continue;
        const doc = state.virtual ?
          new VirtualFileDocument(state.name, state.handle, this.core) :
          new FileDocument(state.name, state.handle);
        doc.text = state.virtual ? "" : state.text;
        // Virtual documents must reload their Blob page from disk.
        doc.status = state.virtual ?
          DocumentStatus.LOADING : DocumentStatus.DIRTY;
        if (state.virtual) {
          doc.virtualPageIndex = state.virtualPageIndex ?? 0;
          if (state.virtualEdit?.id && state.virtualEdit?.fingerprint) {
            doc.pendingRecovery = state.virtualEdit;
          }
        }
        doc.cursor = Math.min(state.cursor, doc.text.length);
        doc.scrollTop = state.scrollTop;
        doc.revision = state.revision ?? 0;
        doc.diskRevision = state.diskRevision ?? null;
        doc.lineEnding = state.lineEnding === "\\r\\n" ?
          "\\r\\n" : "\\n";
        doc.hasUtf8Bom = Boolean(state.hasUtf8Bom);
        if (!this.core.register(doc)) {
          throw new Error("Recovered document registration failed");
        }
        restored.push(doc);
        ids.set(state.id, doc.id);
      }
    } catch (error) {
      for (const doc of restored) this.core.unregister(doc.id);
      throw error;
    }
    // Page restoration is asynchronous and never trusts cached text
    // from the last session as authoritative file contents.
    for (const doc of restored.filter(item => item.virtualReadOnly)) {
      void this.core.request(this.id, doc.id, "load", {
        index: doc.virtualPageIndex,
        onProgress: () => this.onChange()
      }).then(() => this.onChange());
    }
    this.documents = restored;
    this.activeId = ids.get(snapshot.activeId) ??
      restored[0]?.id ?? null;
    this.onChange();
    return true;
  }

  get active() {
    return this.documents.find(doc => doc.id === this.activeId) ?? null;
  }

  async receive(action, payload = {}) {
    if (action === "snapshot") return this.snapshot();
    if (action === "restore") return this.restoreSnapshot(payload.snapshot);
    if (action === "list") return FileManagement.summarize(this.documents);
    if (action === "entries") return this.documents.map(doc => ({
      id: doc.id, name: doc.name, status: doc.status,
      handle: doc.handle
    }));
    if (action === "closeMany") return this.closeMany(payload.ids);
    if (action === "new") return this.create();
    if (action === "open") return this.open(payload.handles);
    if (action === "page") return this.page(payload);
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
      const file = await handle.getFile();
      // FileDocument still uses its bounded legacy path for small files.
      // Large files are opened as read-only, page-backed documents.
      const large = this.core.readProperty(this.id,
        "VirtualDocumentPolicy").value.isVirtual(file.size);
      const doc = large ?
        new VirtualFileDocument(handle.name, handle, this.core) :
        new FileDocument(handle.name, handle);
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


  async page({ id = this.activeId, index } = {}) {
    const doc = this.documents.find(item => item.id === id);
    if (!doc?.virtualReadOnly) {
      const error = new Error("Document has no virtual page");
      error.status = 400;
      throw error;
    }
    const result = await this.core.request(this.id, doc.id, "page", {
      index, onProgress: () => this.onChange()
    });
    if (!result.ok) {
      const error = new Error(result.error);
      error.status = result.status;
      throw error;
    }
    this.onChange();
    return result.value;
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
    if (doc.virtualReadOnly && doc.status === DocumentStatus.DIRTY) {
      // Closing an edited large file offers Save rather than an
      // unconditional 409. Cancel leaves the journal and tab intact.
      const locale = this.core.readProperty(this.id, "Language").value;
      if (!window.confirm(Language.translate(locale,
        "virtualSaveBeforeClose", { name: doc.name }))) return false;
      return this.saveVirtualBeforeClose(doc, id);
    }
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

  /**
   * Keep the original synchronous Close contract for clean files.
   * Only a confirmed dirty virtual file needs asynchronous writeback.
   */
  async saveVirtualBeforeClose(doc, id) {
    const saved = await this.core.request(this.id, doc.id, "save", {
      onProgress: () => this.onChange()
    });
    if (!saved.ok) {
      const error = new Error(saved.error);
      error.status = saved.status;
      throw error;
    }
    // A successful file commit is the only point at which the
    // document may be unregistered from the workspace.
    return this.close(id);
  }

  /**
   * Close a related group atomically: no tab is removed if the user
   * refuses to discard any unsaved changes.
   */
  closeMany(ids) {
    if (!Array.isArray(ids)) {
      const error = new TypeError("Document IDs must be an array");
      error.status = 400;
      throw error;
    }
    const targets = this.documents.filter(doc => ids.includes(doc.id));
    if (targets.some(doc => doc.virtualReadOnly &&
        doc.status === DocumentStatus.DIRTY)) {
      return this.saveVirtualGroupBeforeClose(targets, () =>
        this.closeMany(ids));
    }
    const dirty = targets.filter(doc =>
      doc.status !== DocumentStatus.SYNCED);
    if (dirty.length && !window.confirm(Language.translate(
      this.core.readProperty(this.id, "Language").value,
      "confirmCloseAll", { count: dirty.length }))) return false;
    const selected = new Set(targets.map(doc => doc.id));
    this.documents = this.documents.filter(doc => !selected.has(doc.id));
    for (const doc of targets) this.core.unregister(doc.id);
    if (!this.documents.some(doc => doc.id === this.activeId)) {
      this.activeId = this.documents[0]?.id ?? null;
    }
    this.onChange();
    return true;
  }

  /** One confirmation protects all unsaved documents as one operation. */
  closeAll() {
    if (this.documents.some(doc => doc.virtualReadOnly &&
        doc.status === DocumentStatus.DIRTY)) {
      return this.saveVirtualGroupBeforeClose(
        [...this.documents], () => this.closeAll());
    }
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

  /**
   * Bulk close may be asynchronous only when durable virtual edits
   * require a disk write. No tab is removed until all writes verify.
   * A failure preserves the remaining journals and workspace tabs.
   */
  async saveVirtualGroupBeforeClose(targets, finish) {
    const pending = targets.filter(doc => doc.virtualReadOnly &&
      doc.status === DocumentStatus.DIRTY);
    if (!pending.length) return finish();
    const locale = this.core.readProperty(this.id, "Language").value;
    if (!window.confirm(Language.translate(locale,
      "virtualSaveBeforeCloseAll", { count: pending.length }))) {
      return false;
    }
    for (const doc of pending) {
      const saved = await this.core.request(this.id, doc.id, "save", {
        onProgress: () => this.onChange()
      });
      if (!saved.ok) {
        const error = new Error(saved.error);
        error.status = saved.status;
        throw error;
      }
    }
    return finish();
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
    if (doc.virtualReadOnly) {
      const result = await this.core.request(this.id, doc.id, "save", {
        handle, onProgress: () => this.onChange()
      });
      this.onChange();
      if (!result.ok) {
        const error = new Error(result.error);
        error.status = result.status;
        throw error;
      }
      return true;
    }
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
