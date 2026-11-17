/**
 * PR14.7: host-only approval for remote PowerShell requests.
 *
 * The legacy local Agent executes the approved command in a separate
 * Windows process only after an authenticated browser tool_result.
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
          this.providerId, "local-agent.pair")) {
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
    if (this.busy) {
      this.audit(409, "Busy");
      return { approved: false };
    }
    this.busy = true;
    try {
      // A browser confirm is always necessary, even after the
      // ToolBox master switch is ON. No silent blanket approval.
      const prompt =
        "PowerShell 指令授權 / Command approval" +
        "\nWorkspace: " + workspace +
        "\n\n" + command +
        "\n\n此指令將在 Windows 使用者權限下執行。";
      const approved = this.doc.defaultView.confirm(prompt) === true;
      if (!this.active || !this.explorer.rights.ps) {
        this.audit(403, "RevokedWhilePending");
        return { approved: false };
      }
      this.audit(approved ? 200 : 403,
        approved ? "Approved" : "UserDenied");
      return { approved };
    } finally {
      this.busy = false;
    }
  }
}
