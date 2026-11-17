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
    this.id = "PluginLocalAgentBridge";
    this.strictOCDA = true;
    this.authorization = { default: "Private",
      actions: { pair: "Public", ping: "Public",
        disconnect: "Public", status: "Public" } };
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
    return { ok: false, status };
  }

  close() {
    this.generation++;
    this.state = "disconnected";
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
    if (action === "pair") return this.pair();
    if (action === "ping") return this.ping();
    return this.fail(404, "UnknownAction");
  }

  async pair() {
    if (this.state !== "disconnected") {
      return this.fail(409, "Busy");
    }
    // A host-owned prompt is deliberate: the plugin frame never sees
    // the bearer credential, and no credential is stored anywhere.
    const token = this.doc.defaultView.prompt(
      "Local Agent pairing token (64 hexadecimal characters)");
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
        this.close();
        this.audit(504, "AuthTimeout");
        finish({ ok: false, status: 504 });
      }, Policy.authTimeoutMs);
      socket.onopen = () => {
        if (generation !== this.generation) return;
        try {
          socket.send(JSON.stringify({ type: "auth", token: secret }));
        } catch {
          this.close();
          this.audit(503, "AuthSendFailure");
          finish({ ok: false, status: 503 });
        }
      };
      socket.onmessage = event => {
        if (generation !== this.generation) return;
        const checked = Policy.inspectMessage(event.data);
        if (!checked.ok || checked.value.type === "error") {
          this.close();
          this.audit(checked.ok ? 403 : checked.status,
            "UnexpectedMessage");
          finish({ ok: false, status: checked.ok ? 403 : checked.status });
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
        this.close();
        this.audit(503, "SocketError");
      };
      socket.onclose = () => {
        if (generation !== this.generation) return;
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
