import { FileManagement } from "../property/FileManagement.js";

/**
 * One Explorer tree: imported directories and open documents share identity.
 * A file attached to a folder is represented once, not in a second section.
 * All cross-object operations use HubUnit.
 */
export class Explorer {
  constructor(core) {
    this.id = "explorer";
    this.core = core;
    this.roots = [];
    this.nextRootId = 1;
    this.orderByParent = new Map();
    this.clipboard = null;
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    const actions = ["list", "create", "open", "activate", "openEntry",
      "importFolder", "expand", "refreshTree",
      "snapshotRoots", "restoreRoots", "syncExternal",
      "closeRoot", "reorder", "createFile", "createFolder",
      "renameEntry", "deleteEntry", "copyEntry", "cutEntry",
      "pasteEntry"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions, UserAPI: actions,
      AgentAPI: [], Property: ["FileManagement", "FileTypePolicy", "BlockedFileTypes",
        "ExplorerOrderPolicy", "ExplorerEntryPolicy"],
      Program: "Explorer", EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("Explorer registration failed");
    }
  }

  findNode(id, nodes = this.roots) {
    for (const node of nodes) {
      if (node.id === id) return node;
      const nested = this.findNode(id, node.children ?? []);
      if (nested) return nested;
    }
    return null;
  }

  locateCollection(id, nodes = this.roots, parentId = null) {
    if (nodes.some(node => node.id === id)) {
      return { nodes, parentId };
    }
    for (const node of nodes) {
      const result = this.locateCollection(id,
        node.children ?? [], node.id);
      if (result) return result;
    }
    return null;
  }

  snapshotOrders(root) {
    const policy = this.core.readProperty(
      this.id, "ExplorerOrderPolicy").value;
    const result = {};
    const visit = node => {
      if (node.kind !== "directory") return;
      const suffix = node.id.slice(root.id.length);
      result[suffix] = this.orderByParent.get(node.id) ??
        (node.children ?? []).map(item => policy.key(item));
      for (const child of node.children ?? []) visit(child);
    };
    visit(root);
    return result;
  }

  async sameEntry(left, right) {
    if (!left || !right) return false;
    if (left === right) return true;
    return typeof left.isSameEntry === "function" &&
      await left.isSameEntry(right);
  }

  async readChildren(node) {
    if (node.kind !== "directory") return;
    if (typeof node.handle.values !== "function") {
      const error = new Error("Directory enumeration unavailable");
      error.status = 503;
      throw error;
    }
    const previous = new Map((node.children ?? []).map(child =>
      [child.name + ":" + child.kind, child]));
    const next = [];
    for await (const handle of node.handle.values()) {
      const prior = previous.get(handle.name + ":" + handle.kind);
      if (prior) {
        prior.handle = handle;
        next.push(prior);
      } else {
        next.push({
          id: node.id + "/" + encodeURIComponent(handle.name),
          name: handle.name, kind: handle.kind, handle,
          expanded: false, children: null
        });
      }
    }
    const policy = this.core.readProperty(
      this.id, "ExplorerOrderPolicy").value;
    node.children = policy.ordered(next,
      this.orderByParent.get(node.id));
  }

  /**
   * Compose a single tree. Identity matching works across separately
   * granted handles and prevents duplicates for opened folder files.
   */
  async project(documents, query = "") {
    const claimed = new Set();
    const needle = FileManagement.normalizeQuery(query);
    const policy = this.core.readProperty(this.id, "FileTypePolicy").value;
    const blocked = this.core.readProperty(
      this.id, "BlockedFileTypes").value;
    const visit = async node => {
      const matching = node.kind === "file" ?
        await this.findDocument(node.handle, documents) : null;
      if (matching) claimed.add(matching.id);
      const children = [];
      if (node.expanded) {
        for (const child of node.children ?? []) {
          children.push(await visit(child));
        }
      }
      return {
        id: node.id, name: node.name, kind: node.kind,
        expanded: node.expanded, documentId: matching?.id ?? null,
        children
      };
    };
    const tree = [];
    for (const root of this.roots) tree.push(await visit(root));
    for (const doc of documents) {
      if (claimed.has(doc.id)) continue;
      tree.push({
        id: "tab:" + doc.id, name: doc.name,
        kind: "file", documentId: doc.id,
        expanded: false, children: []
      });
    }
    const filter = node => {
      const children = node.children.map(filter).filter(Boolean);
      if (node.kind === "file" &&
          policy.blocked(node.name, blocked)) return null;
      if (needle && !node.name.toLocaleLowerCase().includes(needle) &&
          children.length === 0) return null;
      return { ...node, children };
    };
    return tree.map(filter).filter(Boolean);
  }

  async findDocument(handle, documents) {
    for (const document of documents) {
      if (await this.sameEntry(handle, document.handle)) return document;
    }
    return null;
  }

  async requestWorkspace(action, payload = {}) {
    const result = await this.core.request(
      this.id, "workspace", action, payload);
    if (!result.ok) {
      const error = new Error(result.error);
      error.status = result.status;
      throw error;
    }
    return result.value;
  }

  // Poll expanded directories, preserving stable node identities.
  async syncExternal() {
    let changed = false;
    const visit = async node => {
      if (node.kind !== "directory" || !node.expanded) return;
      const before = (node.children ?? []).map(child =>
        child.name + ":" + child.kind).join("|");
      await this.readChildren(node);
      const after = (node.children ?? []).map(child =>
        child.name + ":" + child.kind).join("|");
      if (before !== after) changed = true;
      for (const child of node.children ?? []) await visit(child);
    };
    for (const root of this.roots) await visit(root);
    return changed;
  }

  // Root-relative paths retain nested disclosure state between reloads.
  expandedPaths(node, path = "", output = []) {
    if (node.kind !== "directory" || !node.expanded) return output;
    output.push(path);
    for (const child of node.children ?? []) {
      const next = path ? path + "/" + encodeURIComponent(child.name) :
        encodeURIComponent(child.name);
      this.expandedPaths(child, next, output);
    }
    return output;
  }

  async restoreExpansion(root, paths) {
    const selected = new Set(paths);
    const visit = async (node, path, depth) => {
      if (depth > 24 || !selected.has(path)) return;
      await this.readChildren(node);
      node.expanded = true;
      for (const child of node.children ?? []) {
        const next = path ? path + "/" + encodeURIComponent(child.name) :
          encodeURIComponent(child.name);
        await visit(child, next, depth + 1);
      }
    };
    await visit(root, "", 0);
  }


  entryPolicy() {
    return this.core.readProperty(this.id, "ExplorerEntryPolicy").value;
  }

  failure(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    throw error;
  }

  /**
   * Disk mutation is allowed only for discovered, parented entries.
   * Detached editor tabs and imported roots are not filesystem children.
   */
  resolveEntry(id) {
    const node = this.findNode(id);
    const location = this.locateCollection(id);
    const parent = location?.parentId ?
      this.findNode(location.parentId) : null;
    if (!node || !parent || parent.kind !== "directory") {
      this.failure("Explorer entry requires a writable parent", 400);
    }
    return { node, parent };
  }

  async assertNoOpenDocuments(node) {
    const documents = await this.requestWorkspace("entries");
    for (const document of documents) {
      if (!document.handle) continue;
      if (await this.sameEntry(node.handle, document.handle)) {
        this.failure("Close the open document before changing it", 409);
      }
      if (node.kind === "directory" &&
          typeof node.handle.resolve === "function" &&
          Array.isArray(await node.handle.resolve(document.handle))) {
        this.failure("Close child documents before changing a folder", 409);
      }
    }
  }

  async createEntry(kind, payload) {
    const selected = this.findNode(payload.id);
    const folder = selected?.kind === "directory" ? selected :
      this.findNode(this.locateCollection(payload.id)?.parentId);
    if (!folder || folder.kind !== "directory") {
      this.failure("Target folder not found", 404);
    }
    const name = this.entryPolicy().validateName(payload.name);
    await this.entryPolicy().ensureAbsent(folder.handle, name);
    if (kind === "directory") {
      await folder.handle.getDirectoryHandle(name, { create: true });
    } else {
      await folder.handle.getFileHandle(name, { create: true });
    }
    await this.readChildren(folder);
    return true;
  }

  async mutateEntry(action, payload) {
    const { node, parent } = this.resolveEntry(payload.id);
    if (action === "copyEntry" || action === "cutEntry") {
      if (action === "cutEntry") await this.assertNoOpenDocuments(node);
      this.clipboard = {
        sourceId: node.id, handle: node.handle, parentHandle: parent.handle,
        name: node.name, kind: node.kind, cut: action === "cutEntry"
      };
      return true;
    }
    await this.assertNoOpenDocuments(node);
    if (action === "deleteEntry") {
      // Destructive operations always require explicit UI confirmation.
      if (!payload.confirmed) this.failure("Deletion not confirmed", 400);
      await parent.handle.removeEntry(node.name, {
        recursive: node.kind === "directory"
      });
    } else if (action === "renameEntry") {
      const name = this.entryPolicy().validateName(payload.name);
      if (name === node.name) return true;
      await this.entryPolicy().ensureAbsent(parent.handle, name);
      // Legacy local-file fallback: only retire old bytes after a
      // bounded, byte-for-byte readback of the newly committed file.
      if (node.kind !== "file") {
        this.failure("Folder rename is not supported", 501);
      }
      if (typeof node.handle.move === "function") {
        try {
          await node.handle.move(parent.handle, name);
          await this.readChildren(parent);
          return true;
        } catch (error) {
          if (error.name !== "NotSupportedError") throw error;
        }
      }
      const original = await node.handle.getFile();
      const target = await parent.handle.getFileHandle(name, {
        create: true
      });
      try {
        const writer = await target.createWritable();
        try {
          await writer.write(original);
          await writer.close();
        } catch (error) {
          await writer.abort?.();
          throw error;
        }
        const policy = this.entryPolicy();
        const verified = await policy.verifyCopy(
          original, await target.getFile());
        const unchanged = await policy.verifyCopy(
          original, await node.handle.getFile());
        if (!verified || !unchanged) {
          this.failure("Rename source or destination changed", 409);
        }
        await parent.handle.removeEntry(node.name);
      } catch (error) {
        // Never delete the original if copy/verification/retirement fails.
        await parent.handle.removeEntry(name).catch(() => {});
        throw error;
      }
    }
    await this.readChildren(parent);
    return true;
  }

  async pasteEntry(payload) {
    const destination = this.findNode(payload.id);
    const folder = destination?.kind === "directory" ?
      destination : this.findNode(this.locateCollection(payload.id)?.parentId);
    const source = this.clipboard;
    if (!source || !folder || folder.kind !== "directory") {
      this.failure("Clipboard or destination unavailable", 400);
    }
    if (source.kind !== "file") {
      this.failure("Folder paste requires a separate safe tree transaction", 501);
    }
    if (source.cut) {
      const current = this.findNode(source.sourceId);
      if (!current || !await this.sameEntry(current.handle, source.handle)) {
        this.failure("Clipboard source has changed", 409);
      }
      await this.assertNoOpenDocuments(current);
    }
    if (await this.sameEntry(folder.handle, source.parentHandle)) {
      this.failure("Select a different destination folder", 409);
    }
    await this.entryPolicy().ensureAbsent(folder.handle, source.name);
    // Read the source before creating a destination. A cut is a
    // two-phase operation: verified copy, then source retirement.
    const original = await source.handle.getFile();
    const target = await folder.handle.getFileHandle(
      source.name, { create: true });
    let committed = false;
    try {
      const writable = await target.createWritable();
      try {
        await writable.write(original);
        await writable.close();
      } catch (error) {
        await writable.abort?.();
        throw error;
      }
      const policy = this.entryPolicy();
      if (!await policy.verifyCopy(original, await target.getFile()) ||
          !await policy.verifyCopy(
            original, await source.handle.getFile())) {
        this.failure("Source or destination changed during paste", 409);
      }
      if (source.cut) {
        await source.parentHandle.removeEntry(source.name);
        this.clipboard = null;
        const origin = this.findNode(
          this.locateCollection(source.sourceId)?.parentId);
        if (origin) await this.readChildren(origin);
      }
      committed = true;
    } catch (error) {
      // A failed copy must never delete the source. Best-effort cleanup
      // removes an incomplete destination without concealing the error.
      if (!committed) {
        try {
          await folder.handle.removeEntry(source.name);
        } catch (cleanupError) {
          this.core.omu.record("EHU", this.id, "Entry.PasteCleanup",
            503, folder.id, { error: String(cleanupError) });
        }
      }
      this.core.omu.record("EHU", this.id, "Entry.Paste",
        error.status ?? 503, folder.id, { error: String(error) });
      throw error;
    }
    await this.readChildren(folder);
    return true;
  }

  async receive(action, payload = {}) {
    if (action === "createFile") return this.createEntry("file", payload);
    if (action === "createFolder") return this.createEntry("directory", payload);
    if (action === "pasteEntry") return this.pasteEntry(payload);
    if (["renameEntry", "deleteEntry", "copyEntry",
      "cutEntry"].includes(action)) return this.mutateEntry(action, payload);
    if (action === "snapshotRoots") {
      return this.roots.map(root => ({
        name: root.name, handle: root.handle,
        expanded: root.expanded,
        expandedPaths: this.expandedPaths(root),
        orders: this.snapshotOrders(root)
      }));
    }
    if (action === "restoreRoots") {
      if (this.roots.length || !Array.isArray(payload.roots) ||
          payload.roots.length > 40) {
        const error = new Error("Unsafe or duplicate root restore");
        error.status = 409;
        throw error;
      }
      for (const record of payload.roots) {
        if (record.handle?.kind !== "directory") continue;
        const root = {
          id: "root-" + this.nextRootId++,
          name: record.name, kind: "directory",
          handle: record.handle, expanded: false,
          children: null
        };
        this.roots.push(root);
        for (const [suffix, saved] of Object.entries(record.orders ?? {})) {
          if (Array.isArray(saved) && saved.length <= 2000) {
            this.orderByParent.set(root.id + suffix, saved);
          }
        }
        if (record.expanded) {
          try {
            await this.restoreExpansion(root,
              record.expandedPaths ?? [""]);
          } catch (error) {
            this.core.omu.record("EHU", this.id, "Root.Restore",
              503, root.id, { error: String(error) });
          }
        }
      }
      return true;
    }
    if (action === "reorder") {
      if (payload.sourceId?.startsWith("tab:") &&
          payload.targetId?.startsWith("tab:")) {
        const documents = await this.requestWorkspace("entries");
        const from = documents.findIndex(item =>
          "tab:" + item.id === payload.sourceId);
        const to = documents.findIndex(item =>
          "tab:" + item.id === payload.targetId);
        return this.requestWorkspace("reorder", { from, to });
      }
      const located = this.locateCollection(payload.sourceId);
      const target = this.locateCollection(payload.targetId);
      if (!located || !target ||
          located.nodes !== target.nodes) {
        const error = new RangeError("Only sibling entries may move");
        error.status = 400;
        throw error;
      }
      const policy = this.core.readProperty(
        this.id, "ExplorerOrderPolicy").value;
      const moved = policy.move(located.nodes,
        payload.sourceId, payload.targetId);
      if (moved && located.parentId) {
        this.orderByParent.set(located.parentId,
          located.nodes.map(item => policy.key(item)));
      }
      return moved;
    }
    if (action === "closeRoot") {
      const index = this.roots.findIndex(root =>
        root.id === payload.id);
      if (index < 0) {
        const error = new Error("Root not found");
        error.status = 404;
        throw error;
      }
      const root = this.roots[index];
      if (typeof root.handle.resolve !== "function") {
        const error = new Error("Directory identity resolution unavailable");
        error.status = 503;
        throw error;
      }
      const documents = await this.requestWorkspace("entries");
      const ids = [];
      for (const document of documents) {
        if (!document.handle) continue;
        // DirectoryHandle.resolve identifies descendants even if collapsed.
        const path = await root.handle.resolve(document.handle);
        if (Array.isArray(path)) ids.push(document.id);
      }
      const closed = await this.requestWorkspace("closeMany", { ids });
      if (!closed) return false;
      this.roots.splice(index, 1);
      return true;
    }
    if (action === "syncExternal") return this.syncExternal();
    if (action === "importFolder") {
      if (payload.handle?.kind !== "directory") {
        const error = new TypeError("Directory handle required");
        error.status = 400;
        throw error;
      }
      for (const root of this.roots) {
        if (await this.sameEntry(root.handle, payload.handle)) {
          return root.id;
        }
      }
      const root = {
        id: "root-" + this.nextRootId++,
        name: payload.handle.name, kind: "directory",
        handle: payload.handle, expanded: true, children: null
      };
      await this.readChildren(root);
      this.roots.push(root);
      return root.id;
    }
    if (action === "expand") {
      const node = this.findNode(payload.id);
      if (!node || node.kind !== "directory") {
        const error = new Error("Unknown directory");
        error.status = 404;
        throw error;
      }
      if (!node.expanded) await this.readChildren(node);
      node.expanded = !node.expanded;
      return node.expanded;
    }
    if (action === "refreshTree") {
      const collapse = nodes => {
        for (const node of nodes) {
          node.expanded = false;
          collapse(node.children ?? []);
        }
      };
      collapse(this.roots);
      return true;
    }
    if (action === "list") {
      const documents = await this.requestWorkspace("entries");
      return this.project(documents, payload.query);
    }
    if (action === "openEntry") {
      if (typeof payload.id === "string" &&
          payload.id.startsWith("tab:")) {
        return this.requestWorkspace("activate", {
          id: payload.id.slice(4)
        });
      }
      const node = this.findNode(payload.id);
      if (!node || node.kind !== "file") {
        const error = new Error("File entry not found");
        error.status = 404;
        throw error;
      }
      return this.requestWorkspace("open", { handles: [node.handle] });
    }
    const forwarded = {
      create: "new", open: "open", activate: "activate"
    }[action];
    if (!forwarded) {
      const error = new TypeError("Unsupported Explorer action");
      error.status = 400;
      throw error;
    }
    return this.requestWorkspace(forwarded, payload);
  }
}
