import { FileDocument } from "./FileDocument.js";
import { DocumentStatus } from "../property/DocumentStatus.js";

/**
 * Existing editor surface backed by one bounded editable Piece Tree page.
 * Unsaved changes are journaled before publication. Off-page navigation
 * is blocked until the page is committed and verified on disk.
 */
export class VirtualFileDocument extends FileDocument {
  constructor(name, handle, core) {
    super(name, handle);
    this.core = core;
    this.virtualReadOnly = true; // identity flag for workspace/recovery
    this.virtualEditable = false;
    this.virtualPageIndex = 0;
    this.virtualPageCount = 0;
    this.virtualByteLength = 0;
    this.pageStart = 0;
    this.pageEnd = 0;
    this.pageFirstLine = 1;
    this.treeRoot = null;
    this.pieceIndex = null;
    this.fileFingerprint = null;
    this.sourceHash = null;
    this.editSliceId = null;
    this.editRevision = 0;
    this.pendingRecovery = null;
    this.lineCheckpoints = [{ byte: 0, lines: 0 }];
    this.prioritySeed = 0;
    this.ocda = Object.freeze({
      Request: ["load", "page", "describePage", "save", "edit",
        "reconcile"],
      Response: ["load", "page", "describePage", "save", "edit",
        "reconcile"],
      UserAPI: ["page", "describePage", "edit", "save"],
      AgentAPI: [],
      Property: ["UTF8SlicePolicy", "PieceTreePolicy",
        "BPlusSliceIndex", "DocumentStatus", "VirtualPageLinePolicy",
        "SliceTransactionPolicy", "SliceFileWritePolicy"],
      Program: "VirtualFileDocument",
      EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
    });
  }

  property(name) {
    const response = this.core.readProperty(this.id, name);
    if (!response.ok) {
      const error = new Error("Virtual document property unavailable");
      error.status = response.status;
      throw error;
    }
    return response.value;
  }

  failure(message, status) {
    const error = new Error(message);
    error.status = status;
    throw error;
  }

  async invoke(action, payload) {
    const response = await this.core.request(this.id,
      "slice-edit-transaction", action, payload);
    if (!response.ok) {
      this.failure(response.error, response.status);
    }
    return response.value;
  }

  describePage() {
    return {
      id: this.id, index: this.virtualPageIndex,
      count: this.virtualPageCount, size: this.virtualByteLength,
      start: this.pageStart, end: this.pageEnd,
      firstLine: this.pageFirstLine,
      textLength: this.property("PieceTreePolicy").length(this.treeRoot),
      editRevision: this.editRevision,
      dirty: this.status === DocumentStatus.DIRTY
    };
  }

  newEditId() {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (!uuid) this.failure("Secure slice identifier unavailable", 503);
    return "vp-" + uuid.replaceAll("-", "");
  }

  async lineBase(file, offset) {
    const policy = this.property("VirtualPageLinePolicy");
    let anchor = this.lineCheckpoints[0];
    for (const item of this.lineCheckpoints) {
      if (item.byte <= offset && item.byte > anchor.byte) anchor = item;
    }
    const point = await policy.prefix(file, offset, anchor);
    if (!this.lineCheckpoints.some(item => item.byte === point.byte)) {
      this.lineCheckpoints.push(point);
    }
    return point.firstLine;
  }

  async loadPage(index) {
    if (this.status === DocumentStatus.DIRTY) {
      this.failure("Commit the edited page before navigation", 409);
    }
    if (!this.handle) this.failure("Virtual file handle unavailable", 503);
    const file = await this.handle.getFile();
    const fingerprint = this.fingerprint(file);
    if (this.fileFingerprint && this.fileFingerprint !== fingerprint) {
      this.failure("External virtual file changed", 409);
    }
    const bytes = this.property("UTF8SlicePolicy");
    const count = bytes.count(file.size, bytes.defaultChunkBytes);
    if (!Number.isSafeInteger(index) || index < 0 ||
        index >= Math.max(1, count)) {
      this.failure("Virtual page out of range", 400);
    }
    const segment = count ? await bytes.read(
      file, index, bytes.defaultChunkBytes) :
      { start: 0, end: 0, text: "" };
    const startLine = await this.lineBase(file, segment.start);
    const fingerprintHash = this.property("SliceFileWritePolicy");
    const sourceHash = await fingerprintHash.digest(
      await file.slice(segment.start, segment.end).arrayBuffer());
    const tree = this.property("PieceTreePolicy");
    let content = segment.text;
    let editId = this.newEditId();
    let revision = 0;
    let restored = false;

    if (this.pendingRecovery) {
      const pending = this.pendingRecovery;
      if (pending.fingerprint !== fingerprint ||
          pending.sourceHash !== sourceHash ||
          pending.index !== index ||
          pending.start !== segment.start ||
          pending.end !== segment.end) {
        this.failure("Recovered page source changed", 409);
      }
      editId = pending.id;
      const state = await this.invoke("restoreDurable", { id: editId });
      revision = state.revision;
      content = await this.invoke("read", {
        id: editId, start: 0, end: state.length
      });
      restored = true;
    } else {
      await this.invoke("open", { id: editId, text: content });
    }

    const next = content ?
      tree.insert(null, 0, content, () => 1) : null;
    const indexTree = this.property("BPlusSliceIndex")
      .build(tree.pieces(next));
    if (this.editSliceId && this.editSliceId !== editId) {
      await this.invoke("close", { id: this.editSliceId });
    }
    // Publish atomically after the source, journal and B+ index agree.
    this.treeRoot = next;
    this.pieceIndex = indexTree;
    this.text = content;
    this.editSliceId = editId;
    this.editRevision = revision;
    this.pendingRecovery = null;
    this.fileFingerprint = fingerprint;
    this.sourceHash = sourceHash;
    this.diskRevision = fingerprint;
    this.virtualPageIndex = index;
    this.virtualPageCount = Math.max(1, count);
    this.virtualByteLength = file.size;
    this.pageStart = segment.start;
    this.pageEnd = segment.end;
    this.pageFirstLine = startLine;
    this.virtualEditable = true;
    this.status = restored ? DocumentStatus.DIRTY : DocumentStatus.SYNCED;
    this.progress = 100;
    this.error = "";
    this.cursor = 0;
    this.scrollTop = 0;
    this.pageEntryEdge = "start";
    this.revision++;
    return this.describePage();
  }

  async editPage(text) {
    if (!this.virtualEditable || !this.editSliceId) {
      this.failure("Virtual page is not ready to edit", 409);
    }
    const policy = this.property("SliceTransactionPolicy");
    policy.checkText(text);
    if (text === this.text) return this.describePage();
    const change = this.property("VirtualPageLinePolicy")
      .change(this.text, text);
    let seed = this.prioritySeed;
    const priority = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    const tree = this.property("PieceTreePolicy");
    const candidate = policy.apply(
      tree, this.treeRoot, change, priority);
    if (tree.length(candidate) > policy.maxSliceUnits) {
      this.failure("Edited page exceeds memory limit", 413);
    }
    const state = await this.invoke("transactDurable", {
      id: this.editSliceId, revision: this.editRevision,
      operations: [change]
    });
    // Tree update is published only after durable journal ACK.
    this.treeRoot = candidate;
    this.prioritySeed = seed;
    this.pieceIndex = this.property("BPlusSliceIndex")
      .build(tree.pieces(candidate));
    this.text = text;
    this.editRevision = state.revision;
    this.revision++;
    this.status = DocumentStatus.DIRTY;
    return this.describePage();
  }

  async savePage(handle, onProgress = () => {}, signal = null) {
    if (handle && handle !== this.handle) {
      this.failure("Virtual page Save As is not supported", 409);
    }
    if (!this.virtualEditable) {
      this.failure("Virtual page is not editable", 409);
    }
    if (this.status === DocumentStatus.SYNCED) return true;
    if (this.status !== DocumentStatus.DIRTY) {
      this.failure("Page is not ready to write", 409);
    }
    const file = await this.handle.getFile();
    if (this.fingerprint(file) !== this.fileFingerprint) {
      this.failure("External file changed before writeback", 409);
    }
    const result = await this.invoke("commitWriteback", {
      id: this.editSliceId, revision: this.editRevision,
      handle: this.handle, start: this.pageStart, end: this.pageEnd,
      expectedSize: this.virtualByteLength,
      expectedLastModified: file.lastModified,
      expectedSliceHash: this.sourceHash,
      signal, onProgress
    });
    this.status = DocumentStatus.SYNCED;
    this.fileFingerprint = null;
    this.lineCheckpoints = [{ byte: 0, lines: 0 }];
    onProgress(100);
    // Reload from verified disk, incorporating shifted UTF-8 boundaries.
    await this.loadPage(this.virtualPageIndex);
    return { ...result, saved: true };
  }

  async receive(action, payload = {}) {
    if (action === "load" || action === "page") {
      const previousStatus = this.status;
      if (action === "page" && previousStatus === DocumentStatus.DIRTY) {
        this.failure("Save edited page before changing pages", 409);
      }
      this.status = DocumentStatus.LOADING;
      this.progress = 0;
      payload.onProgress?.(0);
      try {
        const oldIndex = this.virtualPageIndex;
        const requestedIndex = action === "load" ?
          payload.index ?? this.virtualPageIndex : payload.index;
        const value = await this.loadPage(requestedIndex);
        // Backwards navigation enters at the last line and caret.
        // Forward navigation enters at the first line.
        if (action === "page" && requestedIndex < oldIndex) {
          this.pageEntryEdge = "end";
          this.cursor = this.text.length;
        }
        payload.onProgress?.(100);
        return value;
      } catch (error) {
        // Preserve a known-good page on navigation failure.
        this.status = action === "page" ?
          previousStatus : DocumentStatus.ERROR;
        this.progress = 100;
        this.error = String(error);
        throw error;
      }
    }
    if (action === "describePage") return this.describePage();
    if (action === "edit") return this.editPage(payload.text);
    if (action === "save") {
      return this.savePage(payload.handle, payload.onProgress,
        payload.signal);
    }
    if (action === "reconcile") {
      if (this.status === DocumentStatus.DIRTY) return false;
      const file = await this.handle.getFile();
      if (this.fingerprint(file) === this.fileFingerprint) return false;
      if (payload.priority === "external") {
        this.fileFingerprint = null;
        this.lineCheckpoints = [{ byte: 0, lines: 0 }];
        const policy = this.property("UTF8SlicePolicy");
        const count = Math.max(1, policy.count(
          file.size, policy.defaultChunkBytes));
        await this.loadPage(Math.min(this.virtualPageIndex, count - 1));
        return true;
      }
      this.failure("External virtual file changed", 409);
    }
    this.failure("Unknown virtual file action", 400);
  }
}
