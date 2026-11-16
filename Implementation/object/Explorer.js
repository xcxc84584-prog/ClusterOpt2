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
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    const actions = ["list", "create", "open", "activate", "openEntry",
      "importFolder", "expand", "refreshTree",
      "snapshotRoots", "restoreRoots", "syncExternal"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions, UserAPI: actions,
      AgentAPI: [], Property: ["FileManagement"],
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
    node.children = next.sort((a, b) =>
      a.kind === b.kind ?
        a.name.localeCompare(b.name) :
        (a.kind === "directory" ? -1 : 1));
  }

  /**
   * Compose a single tree. Identity matching works across separately
   * granted handles and prevents duplicates for opened folder files.
   */
  async project(documents, query = "") {
    const claimed = new Set();
    const needle = FileManagement.normalizeQuery(query);
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

  async receive(action, payload = {}) {
    if (action === "snapshotRoots") {
      return this.roots.map(root => ({
        name: root.name, handle: root.handle,
        expanded: root.expanded,
        expandedPaths: this.expandedPaths(root)
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
