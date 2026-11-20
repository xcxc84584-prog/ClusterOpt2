import { PluginRPCContractPolicy as RPC } from
  "../property/PluginRPCContractPolicy.js";
import { PluginWorkerSource } from "./PluginWorkerSource.js";
import { PluginHostRequestGateway } from
  "./PluginHostRequestGateway.js";
import { PluginHostRequestTransport } from
  "./PluginHostRequestTransport.js";

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
      event.ports.length !== 1) return;
  launched = true;
  const channel = event.ports[0];
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SCRIPT],
      {type:"text/javascript"}));
    try {
      runner = new Worker(url, {type:"classic"});
    } finally {
      URL.revokeObjectURL(url);
    }
    const inner = new MessageChannel();
    channel.onmessage = ({data}) => inner.port1.postMessage(data);
    inner.port1.onmessage = ({data}) => channel.postMessage(data);
    channel.start();
    inner.port1.start();
    runner.onerror = () => {
      channel.postMessage({kind:"error",status:502});
      runner.terminate();
    };
    runner.postMessage({kind:"start",source:event.data.source},
      [inner.port2]);
  } catch {
    channel.postMessage({kind:"error",status:502});
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
    this.manifest = null;
    this.pending = new Map();
    this.sequence = 0;
    this.closed = false;
    this.hostTransport = null;
  }

  /**
   * Only install after the host has registered and granted the Provider.
   * Legacy invocation stays on its existing port handler.
   */
  enableHostRequests(core, approvedRpcScopes = []) {
    if (this.closed || !this.port || this.hostTransport ||
        core?.uru?.getProvider(this.manifest?.providerId)?.objectId !==
          this.manifest?.objectId) {
      return { ok: false, status: 403 };
    }
    const gateway = new PluginHostRequestGateway(
      core, undefined, approvedRpcScopes);
    const transport = new PluginHostRequestTransport(gateway);
    const result = transport.attach(this.port, this.manifest.providerId);
    if (result.ok) this.hostTransport = transport;
    return result;
  }

  /**
   * Disable the reverse API while retaining the isolated Worker.
   * A later resume always creates a new Session and handshake nonce.
   */
  suspendHostRequests() {
    if (!this.hostTransport || !this.port) return false;
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
    this.hostTransport?.detachAll();
    this.hostTransport = null;
    this.port?.close();
    this.port = null;
    // The isolated frame controls the worker, not plugin code.
    this.frame?.contentWindow?.postMessage({
      kind: "cluster-plugin-terminate"
    }, "*");
    this.frame?.remove();
    this.frame = null;
    this.audit(status, reason);
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
    this.port = channel.port1;
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
        }
      };
      frame.addEventListener("load", () => {
        if (this.closed) return;
        frame.contentWindow?.postMessage({
          kind: "cluster-plugin-bootstrap", source
        }, "*", [channel.port2]);
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

  async invoke(service, action, payload, timeoutMs = 4000) {
    if (this.closed || !this.port || !this.frame) {
      return reject(503, "Plugin sandbox unavailable");
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
