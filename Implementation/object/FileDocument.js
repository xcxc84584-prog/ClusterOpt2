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
    this.lineEnding = "\\n";
    this.strictOCDA = true;
    this.ocda = Object.freeze({
      Request: ["edit", "load", "save"],
      Response: ["edit", "load", "save"],
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
      this.hasUtf8Bom = rawText.startsWith("\\uFEFF");
      const text = this.hasUtf8Bom ? rawText.slice(1) : rawText;
      this.lineEnding = text.includes("\\r\\n") ? "\\r\\n" : "\\n";
      this.text = text.replace(/\\r\\n/g, "\\n");
      this.revision++;
      this.progress = 100;
      this.status = DocumentStatus.SYNCED;
      this.name = file.name;
      onProgress(100);
      return { bytes: loaded };
    } catch (error) {
      this.status = DocumentStatus.ERROR;
      this.error = String(error);
      throw error;
    }
  }

  async save(selectedHandle = null, onProgress = () => {}) {
    const handle = selectedHandle ?? this.handle;
    if (!handle) throw new Error("Save needs an authorized file handle");

    const lineNormalized = this.lineEnding === "\\r\\n" ?
      this.text.replace(/\\n/g, "\\r\\n") : this.text;
    const snapshot = (this.hasUtf8Bom ? "\\uFEFF" : "") + lineNormalized;
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
