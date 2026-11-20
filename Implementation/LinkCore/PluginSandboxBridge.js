import { PluginRPCContractPolicy as RPC } from
  "../property/PluginRPCContractPolicy.js";
import { PluginWorkerSource } from "./PluginWorkerSource.js";
import { PluginHostRequestGateway } from
  "./PluginHostRequestGateway.js";
import { PluginHostRequestTransport } from
  "./PluginHostRequestTransport.js";
import { PluginBidirectionalRPCController } from
  "./PluginBidirectionalRPCController.js";
import { PluginBidirectionalEnvelopePolicy as Envelope } from
  "../property/PluginBidirectionalEnvelopePolicy.js";

/**
 * PR13.3/13.5/13.7: opaque iframe launches a dedicated Worker.
 * Only a transferred MessagePort can communicate with the trusted host.
 * No allow-same-origin, network, top navigation or host DOM references.
 * Initial runtime supports self-contained ES modules only.
 */
/** Untrusted JavaScript executes only inside a dedicated Worker.
 * The opaque-origin iframe owns and can terminate that Worker even
 * when the plugin runs an unbounded synchronous computation.
 */
const BOOTSTRAP = String.raw`
"use strict";
let launched = false;
let runner = null;
window.addEventListener("message", event => {
  if (launched || event.source !== parent ||
      event.data?.kind !== "cluster-plugin-bootstrap" ||
      event.ports.length !== 2) return;
  launched = true;
  const channel = event.ports[0];
  const health = event.ports[1];
  health.start();
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SCRIPT],
      {type:"text/javascript"}));
    try {
      runner = new Worker(url, {type:"classic"});
    } finally {
      URL.revokeObjectURL(url);
    }
    // The Worker owns the transferred RPC Port directly. The iframe
    // owns only a separate, non-RPC health Port for crash notification.
    runner.onerror = () => {
      try { health.postMessage({kind:"error",status:502}); }
      catch { /* Worker termination remains authoritative. */ }
      runner.terminate();
    };
    runner.postMessage({
      kind:"start",source:event.data.source,actions:event.data.actions
    },[channel]);
  } catch {
    try { health.postMessage({kind:"error",status:502}); }
    catch { /* Bootstrap will also be bounded by the Host timer. */ }
  }
});
window.addEventListener("message", event => {
  if (event.source === parent &&
      event.data?.kind === "cluster-plugin-terminate") {
    runner?.terminate();
    runner = null;
  }
});
`.replace("WORKER_SCRIPT", JSON.stringify(PluginWorkerSource));

const CSP = "default-src 'none'; script-src 'unsafe-inline' data: blob:; " +
  "connect-src 'none'; img-src data:; style-src 'unsafe-inline'; " +
  "font-src 'none'; object-src 'none'; worker-src blob:; " +
  // Chromium ignores navigate-to in this meta CSP; sandbox remains opaque.
  "child-src 'none'; frame-src 'none'; " +
  "form-action 'none'; base-uri 'none'";

function reject(status, error) {
  return { ok: false, status, error };
}

export class PluginSandboxBridge {
  constructor(doc, omu) {
    this.doc = doc;
    this.omu = omu;
    this.frame = null;
    this.port = null;
    this.healthPort = null;
    this.manifest = null;
    this.pending = new Map();
    this.sequence = 0;
    this.closed = false;
    this.hostTransport = null;
    this.hostController = null;
    this.onFault = null;
  }

  /**
   * Only install after the host has registered and granted the Provider.
   * Legacy invocation stays on its existing port handler.
   */
  enableHostRequests(core, activeRpcScopes = [],
    reviewedRpcScopes = activeRpcScopes) {
    if (this.closed || !this.port || this.hostTransport ||
        core?.uru?.getProvider(this.manifest?.providerId)?.objectId !==
          this.manifest?.objectId) {
      return { ok: false, status: 403 };
    }
    const gateway = new PluginHostRequestGateway(
      core, undefined, activeRpcScopes, reviewedRpcScopes);
    const transport = new PluginHostRequestTransport(gateway);
    const result = transport.attach(this.port, this.manifest.providerId);
    if (result.ok) {
      this.hostTransport = transport;
      this.hostController = new PluginBidirectionalRPCController();
    }
    return result;
  }

  /**
   * Host-controlled scope revocation; never sent as a Worker command.
   * A re-enabled Session retains the remaining reviewed scopes.
   */
  listHostRPCScopes() {
    return this.hostTransport?.gateway.listRpcScopes() ?? Object.freeze([]);
  }

  revokeHostRPCScope(scope) {
    if (!this.hostTransport || this.closed) {
      return { ok: false, status: 503 };
    }
    return this.hostTransport.revokeRpcScope(scope);
  }

  /**
   * Trusted Host only. Caller first suspends the Session so an
   * uncommitted reapproval can never reach the Worker.
   */
  grantReviewedHostRPCScope(scope) {
    if (!this.hostTransport || this.closed) {
      return { ok: false, status: 503 };
    }
    return this.hostTransport.gateway.grantReviewedRpcScope(scope);
  }

  /**
   * Include both directions in the upgrade drain gate. Reverse Host
   * work may ignore AbortSignal, so count it until its promise settles.
   */
  pendingHostRequestCount() {
    let count = this.pending.size +
      (this.hostController?.pendingCount ?? 0);
    for (const entry of this.hostTransport?.connections.values() ?? []) {
      count += entry.inflight;
    }
    return count;
  }

  /**
   * Host-only resource diagnostics and explicit circuit reset.
   * Neither method is included in the Worker-facing SDK.
   */
  getHostRPCCircuitState() {
    return this.hostTransport?.getCircuitState() ??
      Object.freeze({ open: false, timeoutCount: 0 });
  }

  resetHostRPCCircuit(confirmed = false) {
    if (this.closed || !this.hostTransport) {
      return { ok: false, status: 503 };
    }
    return this.hostTransport.resetCircuit(confirmed);
  }

  /**
   * Disable the reverse API while retaining the isolated Worker.
   * A later resume always creates a new Session and handshake nonce.
   */
  suspendHostRequests() {
    if (!this.hostTransport || !this.port) return false;
    const session = this.hostTransport.gateway.sessions
      .sessionForPort(this.port);
    if (session) this.hostController?.revokeSession(session);
    return this.hostTransport.suspend(this.port);
  }

  resumeHostRequests() {
    if (!this.hostTransport || !this.port || this.closed) {
      return { ok: false, status: 503 };
    }
    return this.hostTransport.resume(this.port, this.manifest.providerId);
  }

  audit(status, reason) {
    this.omu?.record(status < 400 ? "Log" : "EHU",
      "PluginSandboxBridge", "Plugin.RPC." + reason, status,
      this.manifest?.providerId ?? "unknown");
  }

  terminate(status = 499, reason = "Terminated") {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.resolve(reject(status, reason));
    }
    this.pending.clear();
    this.hostController?.close();
    this.hostController = null;
    this.hostTransport?.detachAll();
    this.hostTransport = null;
    this.healthPort?.close();
    this.healthPort = null;
    this.port?.close();
    this.port = null;
    // The isolated frame controls the worker, not plugin code.
    this.frame?.contentWindow?.postMessage({
      kind: "cluster-plugin-terminate"
    }, "*");
    this.frame?.remove();
    this.frame = null;
    this.audit(status, reason);
    if (status >= 400 && typeof this.onFault === "function") {
      try { this.onFault(status, reason); }
      catch { /* Host cleanup is authoritative even on callback failure. */ }
    }
  }

  async start(manifest, source, options = {}) {
    if (this.frame || this.closed ||
        !manifest?.provides?.length ||
        typeof source !== "string" ||
        new TextEncoder().encode(source).length > 1048576 ||
        !this.doc?.createElement ||
        typeof MessageChannel !== "function") {
      return reject(400, "Invalid sandbox configuration");
    }
    this.manifest = manifest;
    const frame = this.doc.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.hidden = true;
    // Only trusted bootstrap text enters srcdoc; user code is sent over
    // MessageChannel and imported inside an opaque-origin sandbox.
    frame.srcdoc = "<!doctype html><meta charset='utf-8'>" +
      "<meta http-equiv='Content-Security-Policy' content=\"" +
      CSP + "\"><script>" + BOOTSTRAP + "<\/script>";
    this.frame = frame;
    const channel = new MessageChannel();
    const health = new MessageChannel();
    this.port = channel.port1;
    this.healthPort = health.port1;
    const timeout = Math.min(10000, Math.max(100,
      Number(options.timeoutMs) || 4000));
    const ready = new Promise(resolve => {
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };
      const timer = setTimeout(() => {
        this.terminate(504, "BootstrapTimeout");
        finish(reject(504, "Plugin sandbox bootstrap timed out"));
      }, timeout);
      this.healthPort.onmessage = event => {
        if (event.data?.kind !== "error") return;
        this.terminate(502, "WorkerFault");
        finish(reject(502, "Isolated Worker crashed"));
      };
      this.healthPort.start();
      this.port.onmessage = event => {
        const msg = event.data;
        if (msg?.kind === "ready") {
          this.audit(200, "Bootstrap");
          finish({ ok: true, status: 200 });
        } else if (msg?.kind === "error") {
          this.terminate(502, "BootstrapFailed");
          finish(reject(502, "Plugin source rejected by sandbox"));
        } else if (msg?.kind === "response") {
          this.receive(msg);
        } else if (msg?.protocol === Envelope.protocol &&
            msg.direction === "host-to-plugin" &&
            msg.type === "response") {
          this.receiveBidirectional(msg);
        }
      };
      frame.addEventListener("load", () => {
        if (this.closed) return;
        try {
          frame.contentWindow?.postMessage({
            kind: "cluster-plugin-bootstrap", source,
            actions: manifest.provides.map(item => item.action)
          }, "*", [channel.port2, health.port2]);
        } catch {
          this.terminate(502, "BootstrapPortTransferFailed");
          finish(reject(502, "Plugin bootstrap port transfer failed"));
        }
      }, { once: true });
    });
    (this.doc.body ?? this.doc.documentElement).append(frame);
    return ready;
  }

  receive(message) {
    const item = this.pending.get(message?.id);
    if (!item) {
      this.audit(400, "UnexpectedResponse");
      return;
    }
    const checked = RPC.response(message, item.id);
    clearTimeout(item.timer);
    this.pending.delete(item.id);
    if (!checked.ok) this.audit(checked.status, "ResponseRejected");
    item.resolve(checked);
  }

  /**
   * Host→Plugin requests use the same Session and cluster.rpc/1
   * protocol as the reverse direction. Legacy invoke() is preserved
   * until cross-version migration tests prove full parity.
   */
  async invokeBidirectional(service, action, payload, timeoutMs = 4000) {
    if (this.closed || !this.port || !this.hostController ||
        !this.hostTransport) {
      return reject(503, "Plugin RPC Session unavailable");
    }
    const verified = RPC.request({
      kind: "invoke", id: ++this.sequence, service, action, payload
    }, this.manifest);
    if (!verified.ok) return verified;
    const session = this.hostTransport.gateway.sessions
      .sessionForPort(this.port);
    if (!session || session.state !== "ready") {
      return reject(425, "Plugin RPC handshake incomplete");
    }
    const result = await this.hostController.request(
      this.port, session, this.manifest.objectId, action,
      payload, { deadlineMs: Math.min(30000,
        Math.max(1, Math.floor(timeoutMs))) });
    return result.ok ? { ok: true, status: result.status,
      value: result.data } : { ok: false, status: result.status,
      error: result.errorCode };
  }

  /**
   * Never adopt Worker-supplied eventId as authoritative. The Host
   * assigns a fresh OMU event before settling the Session controller.
   */
  receiveBidirectional(packet) {
    const session = this.hostTransport?.gateway.sessions
      .sessionForPort(this.port);
    const parsed = Envelope.inspect(packet);
    if (!session || session.state !== "ready" ||
        !parsed.ok || !this.hostController ||
        !this.hostController.hasOutstanding(
          this.port, session, packet.requestId)) {
      this.audit(403, "HostResponseRejected");
      return;
    }
    const audit = this.omu.record(
      packet.ok ? "Log" : "EHU",
      this.manifest.objectId, "RPC.HostToPlugin.Response",
      packet.status, "PluginSandboxBridge", {
        requestId: packet.requestId
      });
    const checked = this.hostController.receive(
      this.port, session, {
        ...parsed.value, eventId: audit.eventId
      });
    if (!checked.ok) this.audit(checked.status, "HostResponseRejected");
  }

  async invoke(service, action, payload, timeoutMs = 4000) {
    if (this.closed || !this.port || !this.frame) {
      return reject(503, "Plugin sandbox unavailable");
    }
    // The modern symmetric protocol is the steady-state path. Older
    // bootstrap calls retain the legacy message format until ACK.
    const session = this.hostTransport?.gateway.sessions
      .sessionForPort(this.port);
    if (session?.state === "ready" && this.hostController) {
      return this.invokeBidirectional(
        service, action, payload, timeoutMs);
    }
    if (this.pending.size >= 8) return reject(429, "Busy");
    const id = ++this.sequence;
    const candidate = { kind: "invoke", id, service,
      action, payload };
    const inspected = RPC.request(candidate, this.manifest);
    if (!inspected.ok) {
      this.audit(inspected.status, "RequestRejected");
      return inspected;
    }
    const timeout = Math.min(10000, Math.max(100,
      Number(timeoutMs) || 4000));
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.terminate(504, "Timeout");
      }, timeout);
      this.pending.set(id, { id, resolve, timer });
      try {
        this.port.postMessage(inspected.value);
      } catch {
        this.terminate(502, "TransportFailed");
      }
    });
  }
}
