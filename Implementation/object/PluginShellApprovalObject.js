/**
 * PR14.7: host-only approval for remote PowerShell requests.
 *
 * The legacy local Agent executes the approved command in a separate
 * Windows process only after an authenticated browser tool_result.
 * An explicit trusted ToolBox grant permits subsequent commands in
 * the current session without another modal; revocation denies again.
 * The plugin iframe and Worker cannot approve a command.
 */
export class PluginShellApprovalObject {
  constructor(core, providerId, agentId, explorer, doc) {
    this.core = core;
    this.providerId = providerId;
    this.agentId = agentId;
    this.explorer = explorer;
    this.doc = doc;
    this.id = "PluginShell." +
      providerId.replace(/[^a-zA-Z0-9]/g, "_");
    this.strictOCDA = true;
    this.authorization = { default: "Private", approve: "Public" };
    this.ocda = {
      EHU: [], Log: [], Request: ["approve"],
      Response: ["approve"], UserAPI: [], AgentAPI: [],
      Property: [], Program: "PluginShellApprovalObject"
    };
    this.active = false;
    this.busy = false;
    this.cancelPending = null;
  }

  audit(status, action) {
    this.core.omu.record(status >= 400 ? "EHU" : "Log",
      this.id, "Plugin.Shell." + action,
      status, this.providerId);
  }

  setEnabled(value) {
    this.active = value === true;
    if (!this.active) this.cancelPending?.();
    this.audit(200, this.active ? "Enabled" : "Disabled");
  }

  revoke() {
    this.active = false;
    this.cancelPending?.();
    this.audit(200, "Revoked");
  }

  async receive(action, payload = {}, context = {}) {
    if (action !== "approve" || context.source !== this.agentId ||
        !this.active || !this.explorer?.rights?.ps ||
        !this.explorer.root ||
        !this.core.checkPluginPermission(
          this.providerId, "network.request") ||
        !this.core.checkPluginPermission(
          this.providerId, "local-agent.pair") ||
        !this.core.checkPluginPermission(
          this.providerId, "shell.execute")) {
      this.audit(403, "Denied");
      return { approved: false };
    }
    const command = payload.command;
    const workspace = payload.path;
    if (typeof command !== "string" ||
        command.length < 1 || command.length > 2000 ||
        /[\u0000-\u0008\u000b-\u001f]/.test(command) ||
        typeof workspace !== "string" ||
        workspace !== this.explorer.root.name ||
        !/^[a-zA-Z0-9_. -]{1,100}$/.test(workspace)) {
      this.audit(400, "InvalidRequest");
      return { approved: false };
    }
    // The trusted ToolBox PS checkbox is an explicit session grant.
    // Each command is checked again against live grant, caller and
    // workspace scope. No second browser dialog is required.
    // The native Gateway only executes when this response approves.
    if (!this.active || !this.explorer.rights.ps ||
        !this.explorer.root) {
      this.audit(403, "RevokedBeforeExecution");
      return { approved: false };
    }
    this.audit(200, "SessionApproved");
    return { approved: true };
  }
}
