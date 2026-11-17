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
      disconnect: "Public", status: "Public"
    };
    this.ocda = {
      EHU: [], Log: [], Request: ["pair", "ping", "disconnect", "status"],
      Response: ["pair", "ping", "disconnect", "status"],
      UserAPI: ["pair", "ping", "disconnect", "status"],
      AgentAPI: [], Property: [], Program: "PluginLocalAgentObject"
    };
    this.socket = null;
    this.state = "disconnected";
    this.onState = () => {};
    this.waiting = null;
    this.cancelPrompt = null;
    this.generation = 0;
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
    this.cancelPrompt?.();
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
  }

  async receive(action, payload, context = {}) {
    if (context.source !== "ui" ||
        !this.core.checkPluginPermission(
          this.providerId, "network.request")) {
      return this.fail(403, "Denied");
    }
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
        if (checked.value.type === "ready" &&
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
        resolve(result);
      };
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
