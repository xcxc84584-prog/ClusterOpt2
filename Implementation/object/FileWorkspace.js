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
        "entries", "snapshot", "restore", "closeMany", "sliceManifest"],
      Response: ["new", "open", "page", "activate", "close", "closeAll",
        "reorder", "save", "setPriority", "syncExternal",
      "sliceManifest"],
      UserAPI: ["new", "open", "page", "activate", "close", "closeAll",
        "reorder", "save", "setPriority", "syncExternal"],
      AgentAPI: [],
      Property: ["DocumentStatus", "StoragePriority", "FileManagement",
        "VirtualDocumentPolicy", "DocumentSliceContract"],
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
        scrollLeft: doc.scrollLeft ?? 0,
        viewportLineHeight: doc.viewportLineHeight ?? null,
        revision: doc.revision, diskRevision: doc.diskRevision,
        lineEnding: doc.lineEnding, hasUtf8Bom: doc.hasUtf8Bom,
        virtual: Boolean(doc.virtualReadOnly),
        virtualPageIndex: doc.virtualPageIndex ?? 0,
        virtualEdit: doc.pendingRecovery ?? null,
        virtualEdits: doc.virtualReadOnly ? [
          ...[...doc.dirtyPages.values()].map(entry => ({
            id: entry.id, revision: entry.revision,
            fingerprint: doc.fileFingerprint,
            sourceHash: entry.sourceHash,
            index: entry.index, start: entry.start, end: entry.end,
            baselineLineBreaks: entry.baselineLineBreaks,
            editedLineBreaks: entry.editedLineBreaks
          })),
          ...doc.pendingRecoveries.values()
        ] : []
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
          if (Array.isArray(state.virtualEdits) &&
              state.virtualEdits.length <= 4096) {
            for (const entry of state.virtualEdits) {
              if (entry?.id && entry.fingerprint &&
                  Number.isSafeInteger(entry.index) &&
                  entry.index >= 0) {
                doc.pendingRecoveries.set(entry.index, entry);
              }
            }
          }
          if (state.virtualEdit?.id && state.virtualEdit?.fingerprint) {
            doc.pendingRecovery = state.virtualEdit;
          }
        }
        doc.cursor = Math.min(state.cursor, doc.text.length);
        doc.scrollTop = state.scrollTop;
        doc.scrollLeft = state.scrollLeft ?? 0;
        doc.viewportLineHeight = state.viewportLineHeight ?? null;
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
      // Loading a page resets its viewport to the page beginning.
      // Apply recovered pixel coordinates AFTER the promised load.
      const viewport = {
        top: doc.scrollTop, left: doc.scrollLeft
      };
      void this.core.request(this.id, doc.id, "load", {
        index: doc.virtualPageIndex,
        onProgress: () => this.onChange()
      }).then(result => {
        if (result.ok) {
          doc.scrollTop = viewport.top;
          doc.scrollLeft = viewport.left;
        }
        this.onChange();
      });
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
    if (action === "sliceManifest") {
      const doc = this.documents.find(item => item.id === payload.id);
      if (!doc) {
        const error = new Error("Unknown document");
        error.status = 404;
        throw error;
      }
      const bytes = doc.handle ? (await doc.handle.getFile()).size :
        new TextEncoder().encode(doc.text).byteLength;
      const policy = this.core.readProperty(
        this.id, "DocumentSliceContract").value;
      return policy.describe(doc, bytes);
    }
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
    if (doc.savePromise) await doc.savePromise;
    else await this.writeVirtualDocument(doc);
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
      if (doc.savePromise) await doc.savePromise;
      else await this.writeVirtualDocument(doc);
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

  /**
   * Save runs outside Workspace's dispatch lock, so activating another
   * editor tab never waits for a multi-gigabyte file write.
   */
  async writeVirtualDocument(doc, handle = null) {
    if (doc.saveActive) {
      const error = new Error("Virtual file save already running");
      error.status = 409;
      throw error;
    }
    const began = await this.core.request(this.id,
      "slice-save-task", "begin", {
        id: doc.id, revision: doc.editRevision
      });
    if (!began.ok) {
      const error = new Error(began.error);
      error.status = began.status;
      throw error;
    }
    doc.saveActive = true;
    doc.saveProgress = 0;
    doc.saveError = "";
    this.onChange();
    let visiblePercent = -1;
    const onProgress = percent => {
      const clamped = Math.min(99, Math.max(0, Math.floor(percent)));
      if (clamped === visiblePercent) return;
      visiblePercent = clamped;
      doc.saveProgress = clamped;
      void this.core.request(this.id, "slice-save-task", "progress", {
        id: doc.id, percent: clamped, phase: "writing"
      });
      // Progress paint must not rebuild tabs, Explorer or the editor.
      this.onSaveProgress?.(doc);
    };
    try {
      const response = await this.core.request(this.id, doc.id,
        "save", {
          handle, signal: began.value.signal, onProgress
        });
      if (!response.ok) {
        const error = new Error(response.error);
        error.status = response.status;
        throw error;
      }
      doc.saveProgress = 100;
      return true;
    } catch (error) {
      doc.saveError = String(error);
      // A cancelled writer leaves the prior MVCC journal intact.
      // The user may retry Save after another durable edit.
      if (error.status !== 499) {
        this.core.omu.record("EHU", this.id,
          "BackgroundSave", error.status ?? 503, doc.id,
          { error: String(error) });
      }
      throw error;
    } finally {
      doc.saveActive = false;
      await this.core.request(this.id, "slice-save-task",
        "finish", { id: doc.id });
      this.onChange();
    }
  }

  async save(handle = null) {
    const doc = this.active;
    if (!doc) return false;
    if (doc.virtualReadOnly) {
      if (handle && handle !== doc.handle) {
        const error = new Error("Virtual Save As unsupported");
        error.status = 409;
        throw error;
      }
      if (doc.saveActive) return false;
      // Launch and return without holding the workspace scheduler
      // until file-copy + readback completes.
      const pending = this.writeVirtualDocument(doc, handle);
      doc.savePromise = pending;
      void pending.catch(() => {}).finally(() => {
        if (doc.savePromise === pending) doc.savePromise = null;
      });
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
