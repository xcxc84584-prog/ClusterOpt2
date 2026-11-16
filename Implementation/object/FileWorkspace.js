import { FileDocument } from "./FileDocument.js";
import { DocumentStatus } from "../property/DocumentStatus.js";

/** Manages document collection, activation, and close lifecycle. */
export class FileWorkspace {
  constructor(core, onChange) {
    this.id = "workspace";
    this.core = core;
    this.onChange = onChange;
    this.documents = [];
    this.activeId = null;
    core.register(this);
  }

  get active() {
    return this.documents.find(doc => doc.id === this.activeId) ?? null;
  }

  async receive(action, payload) {
    if (action === "new") return this.create();
    if (action === "open") return this.open();
    if (action === "activate") return this.activate(payload.id);
    if (action === "close") return this.close(payload.id);
    if (action === "save") return this.save(payload.saveAs);
    throw new Error("Unknown workspace action");
  }

  create() {
    const doc = new FileDocument();
    this.documents.push(doc);
    this.core.register(doc);
    this.activeId = doc.id;
    this.onChange();
    return doc.id;
  }

  async open() {
    if (!window.showOpenFilePicker) {
      throw new Error("此瀏覽器不支援檔案開啟；請使用 Chromium HTTPS 或 localhost");
    }
    let handles;
    try {
      handles = await window.showOpenFilePicker({ multiple: true });
    } catch (error) {
      if (error.name === "AbortError") return null;
      throw error;
    }
    for (const handle of handles) {
      // If the same handle was already opened, use its existing tab.
      let existing = null;
      for (const doc of this.documents) {
        if (doc.handle && await doc.handle.isSameEntry(handle)) {
          existing = doc;
          break;
        }
      }
      if (existing) {
        this.activeId = existing.id;
        continue;
      }
      const doc = new FileDocument(handle.name, handle);
      doc.status = DocumentStatus.LOADING;
      this.documents.push(doc);
      this.core.register(doc);
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

  async save(saveAs = false) {
    const doc = this.active;
    if (!doc) return false;
    const result = await this.core.request(this.id, doc.id, "save", {
      saveAs
    });
    this.onChange();
    if (!result.ok) throw new Error(result.error);
    return true;
  }
}
