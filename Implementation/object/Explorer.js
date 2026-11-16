import { FileManagement } from "../property/FileManagement.js";

/**
 * Explorer owns a view of granted directory handles, never file text.
 * Folder traversal is lazy and bounded to one level per expansion.
 * All public operations are routed by HubUnit.
 */
export class Explorer {
  constructor(core) {
    this.id = "explorer";
    this.core = core;
    this.roots = [];
    this.nextRootId = 1;
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    const actions = ["list", "create", "open", "activate",
      "importFolder", "expand", "refreshTree"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions, UserAPI: actions,
      AgentAPI: [], Property: ["FileManagement"],
      Program: "Explorer", EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("Explorer registration failed");
    }
  }

  // Avoid exposing FileSystemHandles through the UI metadata response.
  summarizeNode(node) {
    return {
      id: node.id, name: node.name, kind: node.kind,
      expanded: node.expanded,
      children: node.expanded ?
        (node.children ?? []).map(child => this.summarizeNode(child)) : []
    };
  }

  findNode(id, nodes = this.roots) {
    for (const node of nodes) {
      if (node.id === id) return node;
      const nested = this.findNode(id, node.children ?? []);
      if (nested) return nested;
    }
    return null;
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
      const key = handle.name + ":" + handle.kind;
      const prior = previous.get(key);
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

  async receive(action, payload = {}) {
    if (action === "importFolder") {
      if (payload.handle?.kind !== "directory") {
        const error = new TypeError("Directory handle required");
        error.status = 400;
        throw error;
      }
      for (const root of this.roots) {
        if (root.handle === payload.handle ||
            (typeof root.handle.isSameEntry === "function" &&
            await root.handle.isSameEntry(payload.handle))) {
          return root.id;
        }
      }
      const root = {
        id: "root-" + this.nextRootId++,
        name: payload.handle.name, kind: "directory",
        handle: payload.handle, expanded: true, children: null
      };
      // Directory read failure must not pollute the root registry.
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
      // Legacy refresh collapses all folders without closing editors.
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
      const result = await this.core.request(this.id, "workspace", "list");
      if (!result.ok) {
        const error = new Error(result.error);
        error.status = result.status;
        throw error;
      }
      return {
        documents: FileManagement.filter(result.value, payload.query),
        roots: this.roots.map(root => this.summarizeNode(root))
      };
    }
    const forwarded = {
      create: "new", open: "open", activate: "activate"
    }[action];
    if (!forwarded) {
      const error = new TypeError("Unsupported Explorer action");
      error.status = 400;
      throw error;
    }
    const result = await this.core.request(
      this.id, "workspace", forwarded, payload);
    if (!result.ok) {
      const error = new Error(result.error);
      error.status = result.status;
      throw error;
    }
    return result.value;
  }
}
