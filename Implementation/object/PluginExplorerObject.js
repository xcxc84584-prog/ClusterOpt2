/**
 * PR14.6 — Scoped file access for the AI Agent plugin.
 * Directory handles are retained in the trusted host, never serialized
 * into plugin frames, models, logs or browser storage.
 */
const OPERATIONS = Object.freeze({
  list: "read", read: "read", readChunk: "read",
  create: "create",
  update: "update", delete: "delete"
});
const MAX_READ_BYTES = 1024 * 1024;
const MAX_WRITE_BYTES = 1024 * 1024;
const MAX_ENTRIES = 200;

export class PluginExplorerObject {
  constructor(core, providerId) {
    this.core = core;
    this.providerId = providerId;
    this.id = "PluginExplorer." +
      providerId.replace(/[^a-zA-Z0-9]/g, "_");
    this.strictOCDA = true;
    this.authorization = {
      default: "Private", status: "Public", roots: "Public",
      list: "Public",
      read: "Public", readChunk: "Public",
      create: "Public", update: "Public",
      delete: "Public"
    };
    this.ocda = {
      EHU: [], Log: [],
      Request: ["status", "roots", ...Object.keys(OPERATIONS)],
      Response: ["status", "roots", ...Object.keys(OPERATIONS)],
      UserAPI: ["status", "roots", ...Object.keys(OPERATIONS)],
      AgentAPI: ["roots", "list", "read", "readChunk",
        "create", "update", "delete"],
      Property: [], Program: "PluginExplorerObject"
    };
    this.root = null;
    this.agentId = null;
    this.label = "";
    this.rights = {
      read: false, create: false, update: false,
      delete: false, ps: false
    };
  }

  audit(action, status, details = {}) {
    this.core.omu.record(status >= 400 ? "EHU" : "Log",
      this.id, "Plugin.Explorer." + action, status,
      this.providerId, details);
  }

  fail(action, status) {
    this.audit(action, status);
    const error = new Error("File operation rejected");
    error.status = status;
    throw error;
  }

  authorizeAgent(objectId) {
    if (typeof objectId !== "string" ||
        !objectId.startsWith("PluginLocalAgent.")) {
      return this.fail("InvalidAgent", 400);
    }
    this.agentId = objectId;
  }

  setRoot(handle, label) {
    if (!handle || handle.kind !== "directory") {
      return this.fail("RootInvalid", 400);
    }
    this.root = handle;
    // Display label only: the absolute path is not an authority.
    this.label = String(label || handle.name).slice(0, 512);
    this.rights = {
      read: false, create: false, update: false,
      delete: false, ps: false
    };
    this.audit("RootSelected", 200);
    return this.status();
  }

  setRight(name, enabled) {
    if (!Object.hasOwn(this.rights, name)) {
      return this.fail("RightInvalid", 400);
    }
    if (!this.root && enabled) {
      return this.fail("RootRequired", 409);
    }
    this.rights[name] = enabled === true;
    this.audit("PermissionChanged", 200, { name, enabled });
    return this.status();
  }

  status() {
    return {
      selected: Boolean(this.root),
      folderName: this.root?.name ?? "",
      permissions: { ...this.rights }
    };
  }

  revoke() {
    this.root = null;
    this.label = "";
    for (const name of Object.keys(this.rights)) {
      this.rights[name] = false;
    }
    this.audit("Revoked", 200);
  }

  async receive(action, payload = {}, context = {}) {
    const fromAgent = context.source === this.agentId &&
      this.agentId !== null;
    if ((context.source !== "ui" && !fromAgent) ||
        !["status", "roots", ...Object.keys(OPERATIONS)]
          .includes(action)) {
      return this.fail("SourceDenied", 403);
    }
    if (action === "status") return this.status();
    if (action === "roots") {
      if (!this.root) return this.fail("RootRequired", 409);
      return { roots: [this.root.name] };
    }
    const right = OPERATIONS[action];
    if (!this.root || !this.rights[right]) {
      return this.fail("PermissionDenied", 403);
    }
    const mode = ["create", "update", "delete"].includes(action) ?
      "readwrite" : "read";
    // Never silently promote a prompted browser permission.
    if (typeof this.root.queryPermission !== "function" ||
        await this.root.queryPermission({ mode }) !== "granted") {
      return this.fail("BrowserPermission", 403);
    }
    const parts = this.validPath(payload.path ?? "");
    let folder = this.root;
    const directoryParts = action === "list" ?
      parts : parts.slice(0, -1);
    try {
      for (const segment of directoryParts) {
        folder = await folder.getDirectoryHandle(segment);
      }
      if (action === "list") {
        const entries = [];
        for await (const [name, handle] of folder.entries()) {
          if (entries.length >= MAX_ENTRIES) break;
          entries.push({ name, kind: handle.kind });
        }
        this.audit("List", 200, { count: entries.length });
        return { entries, truncated: entries.length >= MAX_ENTRIES };
      }
      if (parts.length === 0) return this.fail("PathEmpty", 400);
      const name = parts.at(-1);
      if (action === "delete") {
        await folder.removeEntry(name, { recursive: false });
        this.audit("Delete", 200);
        return { deleted: true };
      }
      if (action === "create") {
        // Ensure a create cannot overwrite an existing file.
        try {
          await folder.getFileHandle(name);
          return this.fail("AlreadyExists", 409);
        } catch (error) {
          if (error?.name !== "NotFoundError") throw error;
        }
      }
      const handle = await folder.getFileHandle(name, {
        create: action === "create"
      });
      if (action === "readChunk") {
        const offset = payload.offset ?? 0;
        const length = payload.length ?? 65536;
        if (!Number.isSafeInteger(offset) || offset < 0 ||
            !Number.isSafeInteger(length) ||
            length < 1 || length > 262144) {
          return this.fail("InvalidChunk", 400);
        }
        const file = await handle.getFile();
        const data = await file.slice(offset, offset + length)
          .arrayBuffer();
        const content = new TextDecoder("utf-8")
          .decode(data);
        this.audit("ReadChunk", 200, { bytes: data.byteLength });
        return {
          content, size: file.size,
          lastModified: file.lastModified, offset,
          nextOffset: Math.min(file.size, offset + length),
          hasMore: offset + length < file.size
        };
      }
      if (action === "read") {
        const file = await handle.getFile();
        if (file.size > MAX_READ_BYTES) {
          return this.fail("ReadLimit", 413);
        }
        const text = await file.text();
        this.audit("Read", 200, { bytes: file.size });
        return { text };
      }
      const content = action === "create" &&
        payload.content === undefined ? "" : payload.content;
      if (typeof content !== "string" ||
          new TextEncoder().encode(content).length >
          MAX_WRITE_BYTES) {
        return this.fail("WriteLimit", 413);
      }
      const stream = await handle.createWritable();
      try {
        await stream.write(content);
        await stream.close();
      } catch (error) {
        await stream.abort().catch(() => {});
        throw error;
      }
      this.audit(action, 200);
      return { written: true };
    } catch (error) {
      if (error?.status) throw error;
      const status = error?.name === "NotFoundError" ? 404 :
        error?.name === "NotAllowedError" ? 403 : 500;
      return this.fail(action, status);
    }
  }

  validPath(value) {
    if (typeof value !== "string" || value.length > 1024 ||
        value.startsWith("/") || value.includes("\\") ||
        value.includes("\0")) {
      return this.fail("InvalidPath", 400);
    }
    const parts = value === "" ? [] : value.split("/");
    if (parts.length > 12 || parts.some(part =>
      !part || part === "." || part === ".." ||
      /[:*?"<>|]/.test(part))) {
      return this.fail("InvalidPath", 400);
    }
    return parts;
  }
}
