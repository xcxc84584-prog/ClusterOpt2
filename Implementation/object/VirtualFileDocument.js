import { FileDocument } from "./FileDocument.js";
import { DocumentStatus } from "../property/DocumentStatus.js";

/**
 * Large-file document: only one bounded UTF-8 page is kept in memory.
 * The existing textarea is a read-only window until PR8 Patch19
 * supplies a virtual editable viewport and durable slice binding.
 */
export class VirtualFileDocument extends FileDocument {
  constructor(name, handle, core) {
    super(name, handle);
    this.core = core;
    this.virtualReadOnly = true;
    this.virtualPageIndex = 0;
    this.virtualPageCount = 0;
    this.virtualByteLength = 0;
    this.pageStart = 0;
    this.pageEnd = 0;
    this.treeRoot = null;
    this.pieceIndex = null;
    this.fileFingerprint = null;
    this.ocda = Object.freeze({
      Request: ["load", "page", "describePage", "save",
        "edit", "reconcile"],
      Response: ["load", "page", "describePage", "save",
        "edit", "reconcile"],
      UserAPI: ["page", "edit", "save"], AgentAPI: [],
      Property: ["UTF8SlicePolicy", "PieceTreePolicy",
        "BPlusSliceIndex", "DocumentStatus"],
      Program: "VirtualFileDocument",
      EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
    });
  }

  property(name) {
    const result = this.core.readProperty(this.id, name);
    if (!result.ok) {
      const error = new Error("Virtual document Property unavailable");
      error.status = result.status;
      throw error;
    }
    return result.value;
  }

  describePage() {
    return {
      id: this.id, index: this.virtualPageIndex,
      count: this.virtualPageCount, size: this.virtualByteLength,
      start: this.pageStart, end: this.pageEnd,
      textLength: this.property("PieceTreePolicy").length(this.treeRoot)
    };
  }

  async loadPage(index) {
    if (!this.handle) {
      const error = new Error("Virtual file handle unavailable");
      error.status = 503;
      throw error;
    }
    const file = await this.handle.getFile();
    const fingerprint = this.fingerprint(file);
    if (this.fileFingerprint && this.fileFingerprint !== fingerprint) {
      const error = new Error("External virtual file changed");
      error.status = 409;
      throw error;
    }
    const bytes = this.property("UTF8SlicePolicy");
    const count = bytes.count(file.size, bytes.defaultChunkBytes);
    if (!Number.isSafeInteger(index) || index < 0 ||
        index >= Math.max(1, count)) {
      const error = new RangeError("Virtual page out of range");
      error.status = 400;
      throw error;
    }
    // A zero-byte file has one empty page, with no range read.
    const segment = count ? await bytes.read(
      file, index, bytes.defaultChunkBytes) :
      { start: 0, end: 0, text: "" };
    const tree = this.property("PieceTreePolicy");
    const root = segment.text ?
      tree.insert(null, 0, segment.text, () => 1) : null;
    const indexTree = this.property("BPlusSliceIndex")
      .build(tree.pieces(root));
    // Publish a complete page only after its UTF-8 read succeeds.
    this.treeRoot = root;
    this.pieceIndex = indexTree;
    this.text = tree.read(root, 0, tree.length(root));
    this.fileFingerprint = fingerprint;
    this.diskRevision = fingerprint;
    this.virtualPageIndex = index;
    this.virtualPageCount = Math.max(1, count);
    this.virtualByteLength = file.size;
    this.pageStart = segment.start;
    this.pageEnd = segment.end;
    this.status = DocumentStatus.SYNCED;
    this.progress = 100;
    this.error = "";
    this.cursor = 0;
    this.scrollTop = 0;
    this.revision++;
    return this.describePage();
  }

  async receive(action, payload = {}) {
    if (action === "load") {
      this.status = DocumentStatus.LOADING;
      try {
        const page = await this.loadPage(
          payload.index ?? this.virtualPageIndex);
        payload.onProgress?.(100);
        return page;
      } catch (error) {
        this.status = DocumentStatus.ERROR;
        this.error = String(error);
        throw error;
      }
    }
    if (action === "page") {
      const oldStatus = this.status;
      this.status = DocumentStatus.LOADING;
      this.progress = 0;
      payload.onProgress?.(0);
      try {
        const page = await this.loadPage(payload.index);
        payload.onProgress?.(100);
        return page;
      } catch (error) {
        // Failed navigation must not destroy a prior readable page.
        this.status = oldStatus;
        this.progress = 100;
        throw error;
      }
    }
    if (action === "describePage") return this.describePage();
    if (action === "reconcile") {
      const file = await this.handle.getFile();
      if (this.fingerprint(file) === this.fileFingerprint) return false;
      if (payload.priority === "external") {
        this.fileFingerprint = null;
        const policy = this.property("UTF8SlicePolicy");
        const count = Math.max(1, policy.count(
          file.size, policy.defaultChunkBytes));
        await this.loadPage(Math.min(
          this.virtualPageIndex, count - 1));
        return true;
      }
      const error = new Error("External virtual file changed");
      error.status = 409;
      throw error;
    }
    // Never allow the legacy whole-file save to truncate a large file.
    if (action === "edit" || action === "save") {
      const error = new Error("Virtual page is not a whole document");
      error.status = 409;
      throw error;
    }
    const error = new TypeError("Unknown virtual file action");
    error.status = 400;
    throw error;
  }
}
