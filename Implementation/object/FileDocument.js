import { DocumentStatus } from "../property/DocumentStatus.js";

let nextId = 1;

/** Single document data and its File System Access handle. */
export class FileDocument {
  constructor(name = "Untitled.txt", handle = null) {
    this.id = "document-" + nextId++;
    this.name = name;
    this.handle = handle;
    this.text = "";
    this.status = DocumentStatus.DIRTY;
    this.progress = 0;
    this.error = "";
    this.cursor = 0;
    this.scrollTop = 0;
  }

  async receive(action, payload) {
    if (action === "edit") {
      this.text = payload.text;
      this.status = DocumentStatus.DIRTY;
      return this.status;
    }
    if (action === "load") return this.load(payload.onProgress);
    if (action === "save") return this.save(payload.saveAs);
    throw new Error("Unsupported document action: " + action);
  }

  async load(onProgress = () => {}) {
    if (!this.handle) throw new Error("No associated file handle");
    this.status = DocumentStatus.LOADING;
    this.progress = 0;
    try {
      const file = await this.handle.getFile();
      const reader = file.stream().getReader();
      const chunks = [];
      let loaded = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        this.progress = file.size ? Math.round(loaded * 100 / file.size) : 100;
        onProgress(this.progress);
      }
      const bytes = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      this.text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      this.status = DocumentStatus.SYNCED;
      this.progress = 100;
      this.name = file.name;
      onProgress(100);
      return true;
    } catch (error) {
      this.status = DocumentStatus.ERROR;
      this.error = String(error);
      throw error;
    }
  }

  async save(saveAs = false) {
    this.status = DocumentStatus.LOADING;
    this.progress = 0;
    try {
      let handle = this.handle;
      if (saveAs || !handle) {
        if (!window.showSaveFilePicker) {
          throw new Error("此瀏覽器不支援另存檔案；請使用 Chromium HTTPS 或 localhost");
        }
        handle = await window.showSaveFilePicker({
          suggestedName: this.name
        });
      }
      const writer = await handle.createWritable();
      try {
        await writer.write(this.text);
        await writer.close();
      } catch (error) {
        await writer.abort().catch(() => {});
        throw error;
      }
      this.handle = handle;
      this.name = handle.name;
      this.progress = 100;
      this.status = DocumentStatus.SYNCED;
      return true;
    } catch (error) {
      // Cancelled picker must preserve the unsaved content and dirty state.
      this.status = error.name === "AbortError" ?
        DocumentStatus.DIRTY : DocumentStatus.ERROR;
      this.error = String(error);
      throw error;
    }
  }
}
