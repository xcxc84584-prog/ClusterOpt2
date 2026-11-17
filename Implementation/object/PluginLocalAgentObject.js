import { PluginLocalAgentPolicy as Policy } from
  "../property/PluginLocalAgentPolicy.js";

/**
 * Host-owned OCDA Object: one explicitly approved local connection.
 * No model, tool, shell, file or MCP message may transit this bridge.
 * Pairing token exists only in a local function scope during auth.
 */
export class PluginLocalAgentObject {
  constructor(core, providerId, doc, createSocket = address =>
    new doc.defaultView.WebSocket(address)) {
    this.core = core;
    this.providerId = providerId;
    this.doc = doc;
    this.createSocket = createSocket;
    this.id = "PluginLocalAgent." +
      providerId.replace(/[^a-zA-Z0-9]/g, "_");
    this.strictOCDA = true;
    this.authorization = {
      default: "Private", pair: "Public", ping: "Public",
      disconnect: "Public", status: "Public",
      providerSet: "Public", providerGet: "Public",
      taskStart: "Public", taskCancel: "Public"
    };
    this.ocda = {
      EHU: [], Log: [], Request: ["pair", "ping", "disconnect",
        "status", "providerSet", "providerGet", "taskStart", "taskCancel"],
      Response: ["pair", "ping", "disconnect", "status",
        "providerSet", "providerGet", "taskStart", "taskCancel"],
      UserAPI: ["pair", "ping", "disconnect", "status"],
      AgentAPI: [], Property: [], Program: "PluginLocalAgentObject"
    };
    this.socket = null;
    this.state = "disconnected";
    this.onState = () => {};
    this.onShellResult = () => {};
    this.waiting = null;
    this.pendingPing = null;
    this.cancelPrompt = null;
    this.modelTaskId = null;
    this.generation = 0;
    this.modelReplyQueue = Promise.resolve();
    this.shellApprovalId = null;
    this.mcpReadId = null;
    this.bridgeRegistered = false;
  }

  audit(status, action) {
    this.core.omu.record(status < 400 ? "Log" : "EHU",
      this.id, "Plugin.LocalAgent." + action, status, this.providerId);
  }

  publish() {
    this.onState({ state: this.state });
  }

  fail(status, action) {
    this.audit(status, action);
    const error = new Error("Local Agent request rejected");
    error.status = status;
    throw error;
  }

  close() {
    this.generation++;
    this.modelReplyQueue = Promise.resolve();
    this.bridgeRegistered = false;
    this.cancelPrompt?.();
    this.pendingPing?.({ ok: false, status: 503 });
    this.state = "disconnected";
    this.onPong = null;
    const socket = this.socket;
    this.socket = null;
    if (this.waiting) {
      this.waiting({ ok: false, status: 503 });
      this.waiting = null;
    }
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try { socket.close(1000, "User disconnected"); }
      catch { /* Closing a failed transport is best effort. */ }
    }
    this.publish();
    if (this.modelTaskId) {
      void this.core.request(this.id, this.modelTaskId,
        "reset", {});
    }
  }

  /**
   * Only trusted ToolBox code can enable the legacy MCP bridge.
   * Every shell request is separately approved by a host-owned Object.
   */
  registerShellBridge(objectId) {
    if (typeof objectId !== "string" ||
        !objectId.startsWith("PluginShell.") ||
        this.state !== "connected" || !this.socket) {
      return { ok: false, status: 409 };
    }
    this.shellApprovalId = objectId;
    try {
      this.socket.send(JSON.stringify({ type: "bridge_register" }));
      return { ok: true, status: 200 };
    } catch {
      this.shellApprovalId = null;
      return { ok: false, status: 503 };
    }
  }

  disableShellBridge() {
    this.shellApprovalId = null;
  }

  registerReadBridge(objectId) {
    if (typeof objectId !== "string" ||
        !objectId.startsWith("PluginMCPRead.") ||
        this.state !== "connected" || !this.socket) {
      return { ok: false, status: 409 };
    }
    this.mcpReadId = objectId;
    try {
      this.socket.send(JSON.stringify({ type: "bridge_register" }));
      return { ok: true, status: 200 };
    } catch {
      this.mcpReadId = null;
      return { ok: false, status: 503 };
    }
  }

  disableReadBridge() {
    this.mcpReadId = null;
  }

  async dispatchShellTool(message) {
    const requestId = message.requestId;
    let result = message.name === "cluster.powershell_request" ?
      { approved: false } : { error: "Tool access denied" };
    if (message.name === "cluster.powershell_request" &&
        this.shellApprovalId) {
      const reply = await this.core.request(this.id,
        this.shellApprovalId, "approve", {
          command: message.args.command,
          path: message.args.path
        });
      result = {
        approved: reply.ok &&
          reply.value?.approved === true
      };
    } else if (this.mcpReadId && [
      "cluster.list_files", "cluster.get_editor_state",
      "cluster.read_file"
    ].includes(message.name)) {
      const reply = await this.core.request(this.id,
        this.mcpReadId, "call", {
          name: message.name, args: message.args
        });
      result = reply.ok ? reply.value : {
        error: "MCP request failed"
      };
    }
    if (!this.socket || this.state !== "connected") return;
    try {
      this.socket.send(JSON.stringify({
        type: "tool_result", requestId, result
      }));
      const permitted = result?.approved === true ||
        (result && !result.error);
      this.audit(permitted ? 200 : 403,
        permitted ? "ToolApproved" : "ToolDenied");
    } catch {
      this.audit(503, "ToolResultFailed");
      this.close();
    }
  }

  async receive(action, payload, context = {}) {
    const fromUI = context.source === "ui";
    const fromModel = context.source === this.modelTaskId;
    if ((!fromUI && !fromModel) ||
        !this.core.checkPluginPermission(
          this.providerId, "network.request") ||
        !this.core.checkPluginPermission(
          this.providerId, "local-agent.pair")) {
      return this.fail(403, "Denied");
    }
    if (fromModel && ["providerSet", "providerGet", "taskStart",
      "taskCancel"].includes(action)) {
      return this.modelRequest(action, payload);
    }
    if (!fromUI) return this.fail(403, "ModelActionDenied");
    if (action === "status") {
      return { state: this.state };
    }
    if (action === "disconnect") {
      this.close();
      this.audit(200, "Disconnect");
      return { state: this.state };
    }
    if (action === "pair") return this.unwrap(await this.pair());
    if (action === "ping") return this.unwrap(await this.ping());
    return this.fail(404, "UnknownAction");
  }

  unwrap(response) {
    if (!response.ok) return this.fail(response.status, "Rejected");
    return response.value;
  }

  /**
   * The credential form belongs to the trusted host document.
   * No frame, Worker or Hub payload receives its input value.
   */
  askToken() {
    if (!this.doc.createElement) {
      return Promise.resolve(this.doc.defaultView.prompt(
        "Local Agent pairing token (64 hexadecimal characters)"));
    }
    const locale = this.core.readProperty("ui", "Language");
    const english = locale.value === "en";
    const dialog = this.doc.createElement("dialog");
    dialog.setAttribute("aria-label",
      english ? "Local Agent pairing" : "本地 Agent 配對");
    dialog.style.cssText =
      "max-width:min(440px,90vw);border:1px solid var(--ui-border);" +
      "background:var(--ui-panel,#151d2b);" +
      "color:var(--ui-text-on-panel,#fff);border-radius:10px;" +
      "padding:20px;box-shadow:0 12px 36px #0008";
    const heading = this.doc.createElement("h2");
    heading.textContent = english ? "Pair Local Agent" : "配對本地 Agent";
    const notice = this.doc.createElement("p");
    notice.textContent = english ?
      "Enter the 64-character token from your local Agent." :
      "輸入本地 Agent 提供的 64 字元配對碼。";
    const form = this.doc.createElement("form");
    const input = this.doc.createElement("input");
    input.type = "password";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.maxLength = 64;
    input.required = true;
    input.setAttribute("aria-label",
      english ? "Pairing token" : "配對碼");
    input.style.cssText =
      "width:100%;padding:10px;background:var(--ui-control,#182334);" +
      "color:inherit;border:1px solid var(--ui-border);";
    const buttons = this.doc.createElement("div");
    buttons.style.cssText =
      "display:flex;gap:8px;justify-content:flex-end;margin-top:14px";
    const cancel = this.doc.createElement("button");
    cancel.type = "button";
    cancel.textContent = english ? "Cancel" : "取消";
    const submit = this.doc.createElement("button");
    submit.type = "submit";
    submit.textContent = english ? "Connect" : "連線";
    buttons.append(cancel, submit);
    form.append(input, buttons);
    dialog.append(heading, notice, form);
    (this.doc.body ?? this.doc.documentElement).append(dialog);
    return new Promise(resolve => {
      let finished = false;
      const finish = token => {
        if (finished) return;
        finished = true;
        this.cancelPrompt = null;
        input.value = "";
        dialog.close();
        dialog.remove();
        resolve(token);
      };
      this.cancelPrompt = () => finish(null);
      cancel.addEventListener("click", () => finish(null));
      dialog.addEventListener("cancel", event => {
        event.preventDefault();
        finish(null);
      });
      form.addEventListener("submit", event => {
        event.preventDefault();
        finish(input.value.trim());
      });
      dialog.showModal();
      input.focus();
    });
  }

  async pair() {
    if (this.state !== "disconnected") {
      return this.fail(409, "Busy");
    }
    // Pairing input exists only inside the trusted host UI.
    const token = await this.askToken();
    if (token === null) return this.fail(403, "Cancelled");
    const secret = token.trim();
    if (!Policy.validToken(secret)) {
      return this.fail(400, "InvalidToken");
    }
    this.state = "connecting";
    this.publish();
    let socket;
    try { socket = this.createSocket(Policy.address); }
    catch { this.close(); return this.fail(503, "TransportUnavailable"); }
    this.socket = socket;
    const generation = ++this.generation;
    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.waiting === finish) this.waiting = null;
        resolve(value);
      };
      this.waiting = finish;
      const timer = setTimeout(() => {
        if (generation !== this.generation) return;
        finish({ ok: false, status: 504 });
        this.close();
        this.audit(504, "AuthTimeout");
      }, Policy.authTimeoutMs);
      socket.onopen = () => {
        if (generation !== this.generation) return;
        try {
          socket.send(JSON.stringify({ type: "auth", token: secret }));
        } catch {
          finish({ ok: false, status: 503 });
          this.close();
          this.audit(503, "AuthSendFailure");
        }
      };
      socket.onmessage = event => {
        if (generation !== this.generation) return;
        const checked = Policy.inspectMessage(event.data);
        if (!checked.ok || checked.value.type === "error") {
          finish({ ok: false,
            status: checked.ok ? 403 : checked.status });
          this.close();
          this.audit(checked.ok ? 403 : checked.status,
            "UnexpectedMessage");
          return;
        }
        if (checked.value.type === "bridge_registered" &&
            this.shellApprovalId &&
            this.state === "connected") {
          this.bridgeRegistered = true;
          this.audit(200, "BridgeRegistered");
        } else if (checked.value.type === "tool_call" &&
            this.state === "connected" &&
            this.bridgeRegistered) {
          void this.dispatchShellTool(checked.value);
        } else if (checked.value.type ===
                   "powershell_execution_result" &&
                   this.bridgeRegistered) {
          this.audit(200, "ShellResultReceived");
          this.onShellResult(checked.value);
        } else if (["provider_info", "task_status", "task_result"]
        .includes(checked.value.type) &&
          this.state === "connected" && this.modelTaskId) {
          const target = this.modelTaskId;
          const message = checked.value;
          const observedGeneration = this.generation;
          // Delay ingestion one event-loop turn: the originating task
          // Request must release its HubUnit lock before its reply.
          this.modelReplyQueue = this.modelReplyQueue.then(() =>
            new Promise(resolve => setTimeout(resolve, 0))).then(() => {
              if (observedGeneration !== this.generation ||
                  this.state !== "connected") return null;
              return this.core.request(this.id, target,
                "ingest", message);
            }).catch(() => {
              this.audit(500, "ModelDispatchFailed");
            });
        } else if (checked.value.type === "ready" &&
            this.state === "connecting") {
          this.state = "connected";
          this.publish();
          this.audit(200, "Paired");
          finish({ ok: true, status: 200,
            value: { state: this.state } });
        } else if (checked.value.type === "pong" &&
                   this.state === "connected") {
          this.onPong?.(checked.value.requestId);
        } else {
          // Unrequested tool_call/provider_set/etc is never executed.
          this.close();
          this.audit(403, "UnexpectedAction");
        }
      };
      socket.onerror = () => {
        if (generation !== this.generation) return;
        finish({ ok: false, status: 503 });
        this.close();
        this.audit(503, "SocketError");
      };
      socket.onclose = () => {
        if (generation !== this.generation) return;
        finish({ ok: false, status: 503 });
        this.close();
        this.audit(503, "Disconnected");
      };
    });
  }

  /**
   * Host-mediated model transport. A configured key is sent only over
   * the authenticated local socket. Never placed in a Hub payload.
   */
  async modelRequest(action, payload) {
    const capability = action.startsWith("provider") ?
      "model.configure" : "model.task";
    if (!this.core.checkPluginPermission(this.providerId, capability)) {
      return this.fail(403, "ModelDenied");
    }
    if (this.state !== "connected" || !this.socket) {
      return this.fail(503, "ModelDisconnected");
    }
    if (action === "providerSet") {
      const configured = await this.askProviderConfig();
      if (!configured) return this.fail(403, "ModelCancelled");
      this.socket.send(JSON.stringify({
        type: "provider_set", apiKey: configured.apiKey,
        model: configured.model
      }));
      configured.apiKey = "";
      return { sent: true };
    }
    if (action === "providerGet") {
      this.socket.send(JSON.stringify({ type: "provider_get" }));
      return { sent: true };
    }
    if (action === "taskStart") {
      if (!this.modelTaskId || typeof payload?.requestId !== "string") {
        return this.fail(400, "TaskMalformed");
      }
      this.socket.send(JSON.stringify({
        type: "task", requestId: payload.requestId,
        prompt: payload.prompt
      }));
      return { sent: true };
    }
    if (action === "taskCancel") {
      this.socket.send(JSON.stringify({
        type: "task_cancel", requestId: payload.requestId
      }));
      return { sent: true };
    }
    return this.fail(404, "ModelUnknownAction");
  }

  /** Only the trusted host displays the model credential form. */
  askProviderConfig() {
    if (!this.doc.createElement) return Promise.resolve(null);
    const locale = this.core.readProperty("ui", "Language");
    const en = locale.value === "en";
    const dialog = this.doc.createElement("dialog");
    dialog.setAttribute("aria-label",
      en ? "Model configuration" : "模型設定");
    dialog.style.cssText = "padding:20px;max-width:min(440px,90vw);" +
      "background:var(--ui-panel,#152033);" +
      "color:var(--ui-text-on-panel,#fff);" +
      "border:1px solid var(--ui-border);border-radius:9px";
    const form = this.doc.createElement("form");
    const title = this.doc.createElement("h2");
    title.textContent = en ? "Model configuration" : "模型設定";
    const note = this.doc.createElement("p");
    note.textContent = en ?
      "API key is sent to your local Agent, never saved in this browser." :
      "API 金鑰只傳送至本地 Agent，不儲存於瀏覽器。";
    const key = this.doc.createElement("input");
    key.type = "password";
    key.placeholder = "API key";
    key.autocomplete = "off";
    key.maxLength = 256;
    key.required = true;
    const model = this.doc.createElement("input");
    model.type = "text";
    model.placeholder = "Model";
    model.value = "gpt-4.1-mini";
    model.maxLength = 100;
    model.required = true;
    for (const field of [key, model]) {
      field.style.cssText = "display:block;width:100%;padding:9px;" +
        "margin:8px 0;background:var(--ui-control,#1d2734);" +
        "color:inherit;border:1px solid var(--ui-border)";
    }
    const cancel = this.doc.createElement("button");
    cancel.type = "button";
    cancel.textContent = en ? "Cancel" : "取消";
    const save = this.doc.createElement("button");
    save.type = "submit";
    save.textContent = en ? "Save" : "儲存";
    form.append(title, note, key, model, cancel, save);
    dialog.append(form);
    (this.doc.body ?? this.doc.documentElement).append(dialog);
    return new Promise(resolve => {
      let done = false;
      const finish = value => {
        if (done) return;
        done = true;
        this.cancelPrompt = null;
        key.value = "";
        dialog.close();
        dialog.remove();
        resolve(value);
      };
      this.cancelPrompt = () => finish(null);
      cancel.addEventListener("click", () => finish(null));
      dialog.addEventListener("cancel", event => {
        event.preventDefault();
        finish(null);
      });
      form.addEventListener("submit", event => {
        event.preventDefault();
        const apiKey = key.value.trim();
        const modelId = model.value.trim();
        if (!/^sk-[\w-]{10,256}$/.test(apiKey) ||
            !/^[\w.:-]{1,100}$/.test(modelId)) {
          finish(null);
          return;
        }
        finish({ apiKey, model: modelId });
      });
      dialog.showModal();
      key.focus();
    });
  }

  async ping() {
    if (this.state !== "connected" || !this.socket) {
      return this.fail(503, "NotConnected");
    }
    const requestId = this.doc.defaultView.crypto.randomUUID();
    return new Promise(resolve => {
      let finished = false;
      const finish = result => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        this.onPong = null;
        if (this.pendingPing === finish) this.pendingPing = null;
        resolve(result);
      };
      this.pendingPing = finish;
      const timer = setTimeout(() => {
        this.audit(504, "PingTimeout");
        finish({ ok: false, status: 504 });
      }, Policy.pingTimeoutMs);
      this.onPong = id => {
        if (id !== requestId) return;
        this.audit(200, "Pong");
        finish({ ok: true, status: 200,
          value: { state: "connected" } });
      };
      try {
        this.socket.send(JSON.stringify({ type: "ping", requestId }));
      } catch {
        this.audit(503, "PingFailure");
        finish({ ok: false, status: 503 });
      }
    });
  }
}
