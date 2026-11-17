import { DocumentStatus } from "../property/DocumentStatus.js";

/**
 * PR14.8 — explicitly enabled, read-only MCP projection.
 * Never exposes FileSystemHandle, unsaved text or raw OCDA snapshots.
 */
const MAX_FILE_BYTES = 65536;

export class PluginMCPReadOnlyObject {
  constructor(core, providerId, agentId) {
    this.core = core;
    this.providerId = providerId;
    this.agentId = agentId;
    this.id = "PluginMCPRead." +
      providerId.replace(/[^a-zA-Z0-9]/g, "_");
    this.strictOCDA = true;
    this.authorization = { default: "Private", call: "Public" };
    this.ocda = {
      EHU: [], Log: [], Request: ["call"], Response: ["call"],
      UserAPI: [], AgentAPI: [],
      Property: [], Program: "PluginMCPReadOnlyObject"
    };
    this.enabled = false;
  }

  audit(action, status) {
    this.core.omu.record(status < 400 ? "Log" : "EHU",
      this.id, "Plugin.MCP." + action,
      status, this.providerId);
  }

  setEnabled(value) {
    this.enabled = value === true;
    this.audit(this.enabled ? "Enabled" : "Disabled", 200);
  }

  revoke() {
    this.enabled = false;
    this.audit("Revoked", 200);
  }

  async workspace(action) {
    const result = await this.core.request(
      this.id, "workspace", action, {});
    if (!result.ok) {
      this.audit("WorkspaceUnavailable", result.status);
      return null;
    }
    return result.value;
  }

  async receive(action, payload = {}, context = {}) {
    if (action !== "call" || context.source !== this.agentId ||
        !this.enabled ||
        !this.core.checkPluginPermission(
          this.providerId, "network.request") ||
        !this.core.checkPluginPermission(
          this.providerId, "local-agent.pair") ||
        !this.core.checkPluginPermission(
          this.providerId, "mcp.read")) {
      this.audit("Denied", 403);
      return { error: "Denied" };
    }
    const name = payload?.name;
    if (name === "cluster.list_files") {
      const entries = await this.workspace("entries");
      if (!entries) return { error: "Unavailable" };
      this.audit("List", 200);
      return { files: entries.slice(0, 100).map(item => ({
        id: item.id, name: item.name,
        saved: item.status === DocumentStatus.SYNCED
      })) };
    }
    if (name === "cluster.get_editor_state") {
      const snapshot = await this.workspace("snapshot");
      if (!snapshot) return { error: "Unavailable" };
      const current = snapshot.documents.find(item =>
        item.id === snapshot.activeId);
      this.audit("EditorState", 200);
      return {
        activeId: snapshot.activeId,
        fileName: current?.name ?? null,
        saved: current?.status === DocumentStatus.SYNCED,
        openCount: snapshot.documents.length
      };
    }
    if (name === "cluster.read_file") {
      const id = payload?.args?.id;
      if (typeof id !== "string" || id.length > 200) {
        this.audit("InvalidID", 400);
        return { error: "Invalid file ID" };
      }
      const entries = await this.workspace("entries");
      const file = entries?.find(item => item.id === id);
      if (!file || file.status !== DocumentStatus.SYNCED ||
          !file.handle || typeof file.handle.getFile !== "function") {
        this.audit("UnavailableFile", 403);
        return { error: "File not available or unsaved" };
      }
      try {
        const blob = await file.handle.getFile();
        if (blob.size > MAX_FILE_BYTES) {
          this.audit("FileTooLarge", 413);
          return { error: "File exceeds read limit" };
        }
        const text = await blob.text();
        this.audit("ReadFile", 200);
        return { id, text };
      } catch {
        this.audit("ReadFileFailed", 503);
        return { error: "File access failed" };
      }
    }
    this.audit("UnknownTool", 403);
    return { error: "Tool not authorized" };
  }
}
