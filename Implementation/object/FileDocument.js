import { DocumentStatus } from "../property/DocumentStatus.js";

let nextId = 1;
const CHUNK_BYTES = 256 * 1024;
const PR1_SAFE_BYTES = 64 * 1024 * 1024;

/**
 * Black-box document: all data mutations arrive through receive().
 * Browser file picker authorization is handled by the initiating UI action.
 */
export class FileDocument {
  constructor(name = "Untitled.txt", handle = null) {
    this.id = "document-" + nextId++;
    this.name = name;
    this.handle = handle;
    this.text = "";
    this.status = handle ? DocumentStatus.LOADING : DocumentStatus.DIRTY;
    this.progress = 0;
    this.error = "";
    this.cursor = 0;
    this.scrollTop = 0;
    this.revision = 0;
    this.hasUtf8Bom = false;
    this.lineEnding = "\n";
    this.diskRevision = null;
    this.externalChanged = false;
    this.accessBlocked = false;
    this.strictOCDA = true;
    this.ocda = Object.freeze({
      Request: ["edit", "load", "save", "reconcile"],
      Response: ["edit", "load", "save", "reconcile"],
      UserAPI: ["edit", "save"],
      AgentAPI: [],
      Property: ["DocumentStatus"],
      Program: "FileDocument",
      EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
    this.authorization = Object.freeze({ default: "Public" });
  }

  async receive(action, payload = {}) {
    if (action === "edit") {
      if (typeof payload.text !== "string") {
        throw new TypeError("Edit payload must contain text");
      }
      this.text = payload.text;
      this.revision++;
      this.status = DocumentStatus.DIRTY;
      this.error = "";
      return { revision: this.revision };
    }
    if (action === "load") return this.load(payload.onProgress);
    if (action === "reconcile") {
      return this.reconcile(payload.priority, payload.onProgress);
    }
    if (action === "save") {
      return this.save(payload.handle, payload.onProgress);
    }
    throw new Error("Unsupported document action: " + action);
  }

  async load(onProgress = () => {}) {
    if (!this.handle) throw new Error("No associated file handle");
    this.status = DocumentStatus.LOADING;
    this.progress = 0;
    this.error = "";
    try {
      const file = await this.handle.getFile();
      if (file.size > PR1_SAFE_BYTES) {
        const error = new RangeError("PR1 supports files up to 64 MiB; use PR7 for larger files");
        error.status = 413;
        throw error;
      }
      const reader = file.stream().getReader();
      const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
      const parts = [];
      let loaded = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(decoder.decode(value, { stream: true }));
        loaded += value.byteLength;
        this.progress = file.size ?
          Math.min(100, Math.round(loaded * 100 / file.size)) : 100;
        onProgress(this.progress);
      }
      parts.push(decoder.decode());
      const rawText = parts.join("");
      this.hasUtf8Bom = rawText.startsWith("\uFEFF");
      const text = this.hasUtf8Bom ? rawText.slice(1) : rawText;
      this.lineEnding = text.includes("\r\n") ? "\r\n" : "\n";
      this.text = text.replace(/\r\n/g, "\n");
      this.revision++;
      this.progress = 100;
      this.status = DocumentStatus.SYNCED;
      this.name = file.name;
      this.diskRevision = this.fingerprint(file);
      this.externalChanged = false;
      this.accessBlocked = false;
      onProgress(100);
      return { bytes: loaded };
    } catch (error) {
      this.status = DocumentStatus.ERROR;
      this.error = String(error);
      throw error;
    }
  }

  fingerprint(file) {
    return String(file.lastModified) + ":" + String(file.size);
  }

  /**
   * Inspect external file changes without losing local text under
   * InternalFirst. ExternalFirst reloads only when the fingerprint moves.
   */
  async reconcile(priority, onProgress = () => {}) {
    if (!this.handle || !this.diskRevision) return false;
    const previousStatus = this.status;
    const previousError = this.error;
    try {
      const file = await this.handle.getFile();
      const fingerprint = this.fingerprint(file);
      if (fingerprint === this.diskRevision) return false;
      if (priority === "external") {
        await this.load(onProgress);
        this.externalReloaded = true;
      } else {
        this.diskRevision = fingerprint;
        this.externalChanged = true;
        this.status = DocumentStatus.DIRTY;
        onProgress(this.progress);
      }
      return true;
    } catch (error) {
      if (error?.name === "NotAllowedError") {
        // Background polling cannot request new file permissions.
        // Preserve the active text and dirty/synced status; a future
        // explicit user gesture or granted handle can resume polling.
        this.accessBlocked = true;
        // External-first can fail inside load() after it temporarily
        // switched the status to loading/error. Restore the exact
        // pre-poll state without discarding any local changes.
        this.status = previousStatus;
        this.error = previousError;
        return false;
      }
      this.status = DocumentStatus.ERROR;
      this.error = String(error);
      throw error;
    }
  }

  async save(selectedHandle = null, onProgress = () => {}) {
    const handle = selectedHandle ?? this.handle;
    if (!handle) throw new Error("Save needs an authorized file handle");

    // Recovery data cannot downgrade a large file to a partial
    // FileDocument and overwrite the full source with one page.
    // Real FileSystemFileHandle always provides getFile(). Some
    // historical test doubles only implement createWritable().
    if (typeof handle.getFile === "function") {
      const disk = await handle.getFile();
      if (disk.size > PR1_SAFE_BYTES) {
        const error = new Error("Large file requires virtual writeback");
        error.status = 409;
        throw error;
      }
    }

    const lineNormalized = this.lineEnding === "\r\n" ?
      this.text.replace(/\n/g, "\r\n") : this.text;
    const snapshot = (this.hasUtf8Bom ? "\uFEFF" : "") + lineNormalized;
    const snapshotRevision = this.revision;
    this.status = DocumentStatus.LOADING;
    this.progress = 0;
    this.error = "";
    try {
      const writer = await handle.createWritable();
      try {
        const bytes = new TextEncoder().encode(snapshot);
        // Write bounded chunks so operation progress reflects bytes written.
        for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
          const end = Math.min(offset + CHUNK_BYTES, bytes.length);
          await writer.write(bytes.subarray(offset, end));
          this.progress = Math.round(end * 100 / bytes.length);
          onProgress(this.progress);
        }
        if (!bytes.length) await writer.write(new Uint8Array(0));
        await writer.close();
      } catch (error) {
        if (typeof writer.abort === "function") {
          try { await writer.abort(); } catch { /* preserve first error */ }
        }
        throw error;
      }
      this.handle = handle;
      this.name = handle.name;
      const writtenFile = await handle.getFile();
      this.diskRevision = this.fingerprint(writtenFile);
      this.externalChanged = false;
      this.accessBlocked = false;
      this.progress = 100;
      // Preserve newer edits if the editor changed during the save operation.
      this.status = snapshotRevision === this.revision ?
        DocumentStatus.SYNCED : DocumentStatus.DIRTY;
      onProgress(100);
      return { revision: snapshotRevision };
    } catch (error) {
      this.status = DocumentStatus.ERROR;
      this.error = String(error);
      throw error;
    }
  }
}
