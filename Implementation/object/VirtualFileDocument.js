import { FileDocument } from "./FileDocument.js";
import { DocumentStatus } from "../property/DocumentStatus.js";

/**
 * A page-sized Piece Tree viewport over a large immutable source Blob.
 * Dirty pages are retained as independent durable MVCC revisions until
 * a single verified multi-page writeback succeeds.
 */
export class VirtualFileDocument extends FileDocument {
  constructor(name, handle, core) {
    super(name, handle);
    this.core = core;
    this.virtualReadOnly = true; // existing Workspace virtual identity
    this.virtualEditable = false;
    this.virtualPageIndex = 0;
    this.virtualPageCount = 0;
    this.virtualByteLength = 0;
    this.pageStart = 0;
    this.pageEnd = 0;
    this.pageFirstLine = 1;
    this.pageOriginalLineBreaks = 0;
    this.treeRoot = null;
    this.pieceIndex = null;
    this.fileFingerprint = null;
    this.sourceHash = null;
    this.editSliceId = null;
    this.editRevision = 0;
    this.dirtyPages = new Map();
    this.pendingRecoveries = new Map();
    this.pendingRecovery = null; // compatible with Patch19 restore
    this.lineCheckpoints = [{ byte: 0, lines: 0 }];
    this.pageLineCountCache = new Map();
    this.prioritySeed = 0;
    this.ocda = Object.freeze({
      Request: ["load", "page", "seekLine", "describePage", "save",
        "edit", "reconcile"],
      Response: ["load", "page", "seekLine", "describePage", "save",
        "edit", "reconcile"],
      UserAPI: ["page", "seekLine", "describePage", "edit", "save"],
      AgentAPI: [],
      Property: ["UTF8SlicePolicy", "PieceTreePolicy",
        "BPlusSliceIndex", "DocumentStatus", "VirtualPageLinePolicy",
        "SliceTransactionPolicy", "SliceBatchWritePolicy",
        "GlobalPageLinePolicy", "GoToLinePolicy"],
      Program: "VirtualFileDocument",
      EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
    });
  }

  property(name) {
    const response = this.core.readProperty(this.id, name);
    if (!response.ok) this.failure("Virtual Property unavailable",
      response.status);
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
    if (!response.ok) this.failure(response.error, response.status);
    return response.value;
  }

  countLines(text) {
    return (text.match(/\n/g) ?? []).length;
  }

  get unsaved() {
    return this.dirtyPages.size + this.pendingRecoveries.size +
      (this.pendingRecovery ? 1 : 0) > 0;
  }

  describePage() {
    return {
      id: this.id, index: this.virtualPageIndex,
      count: this.virtualPageCount, size: this.virtualByteLength,
      start: this.pageStart, end: this.pageEnd,
      firstLine: this.pageFirstLine,
      textLength: this.property("PieceTreePolicy").length(this.treeRoot),
      editRevision: this.editRevision,
      dirty: this.unsaved,
      dirtyPages: this.dirtyPages.size + this.pendingRecoveries.size
    };
  }

  newEditId() {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (!uuid) this.failure("Secure slice ID unavailable", 503);
    return "vp-" + uuid.replaceAll("-", "");
  }

  /**
   * The source Blob's global LF count is stable until Save. Edits in
   * earlier dirty pages offset every following page's displayed lines.
   */
  async lineBase(file, offset, pageIndex) {
    const policy = this.property("VirtualPageLinePolicy");
    let anchor = this.lineCheckpoints[0];
    for (const item of this.lineCheckpoints) {
      if (item.byte <= offset && item.byte > anchor.byte) anchor = item;
    }
    const point = await policy.prefix(file, offset, anchor);
    if (!this.lineCheckpoints.some(item => item.byte === point.byte)) {
      this.lineCheckpoints.push(point);
    }
    let extraLines = 0;
    const pending = [...this.dirtyPages.values(),
      ...this.pendingRecoveries.values()];
    for (const item of pending) {
      if (item.index < pageIndex) {
        extraLines += (item.editedLineBreaks ?? 0) -
          (item.baselineLineBreaks ?? 0);
      }
    }
    if (this.pendingRecovery?.index < pageIndex) {
      extraLines += (this.pendingRecovery.editedLineBreaks ?? 0) -
        (this.pendingRecovery.baselineLineBreaks ?? 0);
    }
    return point.firstLine + extraLines;
  }

  async loadPage(index) {
    if (!this.handle) this.failure("Virtual file handle unavailable", 503);
    if (this.virtualEditable && index === this.virtualPageIndex) {
      return this.describePage();
    }
    const file = await this.handle.getFile();
    const fingerprint = this.fingerprint(file);
    if (this.fileFingerprint && this.fileFingerprint !== fingerprint) {
      // A clean virtual page can safely rebind to the current file.
      // FileSystemFileHandle.lastModified also changes after a
      // successful internal Save; that is not an edit conflict.
      // Never rebase if ANY edited or recovered page is outstanding.
      if (this.unsaved || this.saveActive) {
        this.failure("External virtual file changed", 409);
      }
      this.lineCheckpoints = [{ byte: 0, lines: 0 }];
      this.pageLineCountCache.clear();
      this.fileFingerprint = null;
      this.diskRevision = null;
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
    const sourceHash = await this.property("SliceBatchWritePolicy")
      .digest(await file.slice(segment.start, segment.end).arrayBuffer());
    const firstLine = await this.lineBase(file, segment.start, index);
    const baselineLineBreaks = this.countLines(segment.text);
    let state = this.dirtyPages.get(index);
    let content = state?.text ?? segment.text;
    let editId = state?.id ?? this.newEditId();
    let revision = state?.revision ?? 0;
    let restored = Boolean(state);

    // Recovery entries are lazy: only the visible journal is loaded.
    const recovery = this.pendingRecoveries.get(index) ??
      (this.pendingRecovery?.index === index ?
        this.pendingRecovery : null);
    if (!state && recovery) {
      if (recovery.fingerprint !== fingerprint ||
          recovery.sourceHash !== sourceHash ||
          recovery.start !== segment.start ||
          recovery.end !== segment.end) {
        this.failure("Recovered dirty source changed", 409);
      }
      editId = recovery.id;
      const durable = await this.invoke("restoreDurable", { id: editId });
      content = await this.invoke("read", {
        id: editId, start: 0, end: durable.length
      });
      revision = durable.revision;
      restored = true;
      state = {
        id: editId, index, revision, text: content,
        start: segment.start, end: segment.end, sourceHash,
        baselineLineBreaks, editedLineBreaks: this.countLines(content)
      };
    } else if (!state) {
      await this.invoke("open", { id: editId, text: content });
    }
    const tree = this.property("PieceTreePolicy");
    const next = content ? tree.insert(null, 0, content, () => 1) :
      null;
    const indexTree = this.property("BPlusSliceIndex")
      .build(tree.pieces(next));
    // A clean offscreen page can be released; dirty pages retain
    // their registered transaction and durable recovery checkpoint.
    if (this.editSliceId && this.editSliceId !== editId &&
        ![...this.dirtyPages.values()].some(entry =>
          entry.id === this.editSliceId)) {
      await this.invoke("close", { id: this.editSliceId });
    }
    if (restored && state) this.dirtyPages.set(index, state);
    if (recovery) {
      this.pendingRecoveries.delete(index);
      if (this.pendingRecovery?.index === index) {
        this.pendingRecovery = null;
      }
    }
    this.treeRoot = next;
    this.pieceIndex = indexTree;
    this.text = content;
    this.editSliceId = editId;
    this.editRevision = revision;
    this.fileFingerprint = fingerprint;
    this.diskRevision = fingerprint;
    this.accessBlocked = false;
    this.sourceHash = sourceHash;
    this.virtualPageIndex = index;
    this.virtualPageCount = Math.max(1, count);
    this.virtualByteLength = file.size;
    this.pageStart = segment.start;
    this.pageEnd = segment.end;
    this.pageFirstLine = firstLine;
    this.pageOriginalLineBreaks = baselineLineBreaks;
    this.virtualEditable = true;
    this.status = this.unsaved ?
      DocumentStatus.DIRTY : DocumentStatus.SYNCED;
    this.progress = 100;
    this.error = "";
    this.cursor = 0;
    this.scrollTop = 0;
    this.pageEntryEdge = "start";
    this.revision++;
    return this.describePage();
  }

  /**
   * Navigate by GLOBAL line, including unloaded pages and edited pages.
   * The bounded locator reads only source byte windows and dirty LF
   * metadata; page text remains authoritative only after loadPage.
   * No partial document state is published until the target is valid.
   */
  async seekLine({ line, lineHeight, viewportHeight,
    onProgress = () => {} }) {
    if (typeof onProgress !== "function" ||
        !Number.isFinite(lineHeight) || lineHeight <= 0 ||
        !Number.isFinite(viewportHeight) || viewportHeight < 0) {
      this.failure("Invalid line seek geometry", 400);
    }
    const file = await this.handle.getFile();
    if (this.fileFingerprint &&
        this.fingerprint(file) !== this.fileFingerprint &&
        this.unsaved) {
      this.failure("External virtual file changed", 409);
    }
    const edits = new Map();
    const pending = [...this.pendingRecoveries.values()];
    if (this.pendingRecovery) pending.push(this.pendingRecovery);
    for (const record of pending) {
      if (this.dirtyPages.has(record.index)) continue;
      const restored = await this.invoke("restoreDurable", {
        id: record.id
      });
      const text = await this.invoke("read", {
        id: record.id, start: 0, end: restored.length
      });
      edits.set(record.index, {
        editedLineBreaks: this.countLines(text),
        endsWithLF: text.endsWith("\n")
      });
    }
    for (const record of this.dirtyPages.values()) {
      edits.set(record.index, {
        editedLineBreaks: record.editedLineBreaks,
        endsWithLF: record.text.endsWith("\n")
      });
    }
    const located = await this.property("GlobalPageLinePolicy").locate({
      file, targetLine: line,
      pageBytes: this.property("UTF8SlicePolicy").defaultChunkBytes,
      edits, cache: this.pageLineCountCache, onProgress
    });
    if (located.index !== this.virtualPageIndex) {
      await this.loadPage(located.index);
    }
    const position = this.property("GoToLinePolicy").resolve({
      text: this.text, firstLine: this.pageFirstLine,
      targetLine: line, lineHeight
    });
    this.cursor = position.offset;
    this.scrollTop = Math.max(0,
      position.scrollTop - viewportHeight / 3);
    this.scrollLeft = 0;
    this.pageEntryEdge = "start";
    return { ...this.describePage(), line, offset: this.cursor,
      scrollTop: this.scrollTop };
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
    const candidate = policy.apply(tree, this.treeRoot, change, priority);
    if (tree.length(candidate) > policy.maxSliceUnits) {
      this.failure("Edited page exceeds memory budget", 413);
    }
    const persisted = await this.invoke("transactDurable", {
      id: this.editSliceId, revision: this.editRevision,
      operations: [change]
    });
    // Publish UI and registry only after IndexedDB revision CAS.
    this.treeRoot = candidate;
    this.prioritySeed = seed;
    this.pieceIndex = this.property("BPlusSliceIndex")
      .build(tree.pieces(candidate));
    this.text = text;
    this.editRevision = persisted.revision;
    this.dirtyPages.set(this.virtualPageIndex, {
      id: this.editSliceId, index: this.virtualPageIndex,
      revision: persisted.revision, text,
      start: this.pageStart, end: this.pageEnd,
      sourceHash: this.sourceHash,
      baselineLineBreaks: this.pageOriginalLineBreaks,
      editedLineBreaks: this.countLines(text)
    });
    this.revision++;
    this.status = DocumentStatus.DIRTY;
    return this.describePage();
  }

  /**
   * Restore all pending durable revisions before a multi-page Save.
   * Never omit an offscreen recovery checkpoint from the commit.
   */
  async hydratePendingPages(file) {
    const pending = new Map(this.pendingRecoveries);
    if (this.pendingRecovery) {
      pending.set(this.pendingRecovery.index, this.pendingRecovery);
    }
    const bytes = this.property("UTF8SlicePolicy");
    const policy = this.property("SliceBatchWritePolicy");
    for (const [index, record] of pending) {
      if (this.dirtyPages.has(index)) {
        this.pendingRecoveries.delete(index);
        continue;
      }
      if (record.fingerprint !== this.fingerprint(file)) {
        this.failure("Recovered source fingerprint changed", 409);
      }
      const segment = await bytes.read(
        file, index, bytes.defaultChunkBytes);
      const sourceHash = await policy.digest(
        await file.slice(segment.start, segment.end).arrayBuffer());
      if (sourceHash !== record.sourceHash ||
          segment.start !== record.start ||
          segment.end !== record.end) {
        this.failure("Recovered source bytes changed", 409);
      }
      const restored = await this.invoke("restoreDurable", {
        id: record.id
      });
      const content = await this.invoke("read", {
        id: record.id, start: 0, end: restored.length
      });
      this.dirtyPages.set(index, {
        id: record.id, index, revision: restored.revision,
        text: content, start: record.start, end: record.end,
        sourceHash, baselineLineBreaks:
          this.countLines(segment.text),
        editedLineBreaks: this.countLines(content)
      });
      this.pendingRecoveries.delete(index);
      if (this.pendingRecovery?.index === index) {
        this.pendingRecovery = null;
      }
    }
  }

  async savePage(handle, onProgress = () => {}, signal = null) {
    if (handle && handle !== this.handle) {
      this.failure("Virtual Save As unsupported", 409);
    }
    if (!this.virtualEditable) {
      this.failure("Virtual page not ready", 409);
    }
    if (!this.unsaved) return true;
    const file = await this.handle.getFile();
    if (this.fingerprint(file) !== this.fileFingerprint) {
      this.failure("External file changed before multi-page write", 409);
    }
    await this.hydratePendingPages(file);
    const edits = [...this.dirtyPages.values()]
      .sort((a, b) => a.start - b.start).map(item => ({
        id: item.id, revision: item.revision,
        index: item.index, start: item.start,
        end: item.end, sourceHash: item.sourceHash
      }));
    const response = await this.core.request(this.id,
      "slice-batch-writeback-unit", "commit", {
        handle: this.handle, edits,
        expectedSize: this.virtualByteLength,
        expectedLastModified: file.lastModified,
        signal, onProgress
      });
    if (!response.ok) this.failure(response.error, response.status);
    for (const item of edits) {
      await this.invoke("finalizeBatch", {
        id: item.id, revision: item.revision
      });
      if (item.id !== this.editSliceId) {
        await this.invoke("close", { id: item.id });
      }
    }
    this.dirtyPages.clear();
    this.status = DocumentStatus.SYNCED;
    this.fileFingerprint = null;
    this.lineCheckpoints = [{ byte: 0, lines: 0 }];
    this.pageLineCountCache.clear();
    this.virtualEditable = false; // force a fresh byte-aligned load
    const viewport = {
      top: this.scrollTop, left: this.scrollLeft ?? 0
    };
    await this.loadPage(this.virtualPageIndex);
    this.scrollTop = viewport.top;
    this.scrollLeft = viewport.left;
    onProgress(100);
    return { ...response.value, saved: true };
  }

  async receive(action, payload = {}) {
    if (action === "load" || action === "page") {
      const intended = action === "load" ?
        payload.index ?? this.virtualPageIndex : payload.index;
      if (this.virtualEditable && intended === this.virtualPageIndex) {
        return this.describePage();
      }
      const oldStatus = this.status;
      this.status = DocumentStatus.LOADING;
      this.progress = 0;
      payload.onProgress?.(0);
      try {
        const previousIndex = this.virtualPageIndex;
        const index = action === "load" ?
          payload.index ?? this.virtualPageIndex : payload.index;
        const result = await this.loadPage(index);
        if (action === "page" && index < previousIndex) {
          this.pageEntryEdge = "end";
          this.cursor = this.text.length;
        }
        payload.onProgress?.(100);
        return result;
      } catch (error) {
        this.status = action === "page" ? oldStatus :
          DocumentStatus.ERROR;
        this.progress = 100;
        this.error = String(error);
        throw error;
      }
    }
    if (action === "seekLine") return this.seekLine(payload);
    if (action === "describePage") return this.describePage();
    if (action === "edit") return this.editPage(payload.text);
    if (action === "save") {
      return this.savePage(payload.handle, payload.onProgress,
        payload.signal);
    }
    if (action === "reconcile") {
      if (this.unsaved) return false;
      let file;
      try {
        file = await this.handle.getFile();
      } catch (error) {
        if (error?.name !== "NotAllowedError") throw error;
        this.accessBlocked = true;
        return false;
      }
      this.accessBlocked = false;
      if (this.fingerprint(file) === this.fileFingerprint) return false;
      if (payload.priority === "external") {
        this.fileFingerprint = null;
        this.lineCheckpoints = [{ byte: 0, lines: 0 }];
        this.virtualEditable = false;
        const bytes = this.property("UTF8SlicePolicy");
        const pages = Math.max(1, bytes.count(
          file.size, bytes.defaultChunkBytes));
        await this.loadPage(Math.min(this.virtualPageIndex, pages - 1));
        return true;
      }
      this.failure("External virtual file changed", 409);
    }
    this.failure("Unknown virtual file action", 400);
  }
}
