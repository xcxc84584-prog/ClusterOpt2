import { PluginRPCContractPolicy as RPC } from
  "../property/PluginRPCContractPolicy.js";

/**
 * PR13.3/13.5: opaque-origin sandboxed iframe running a data: module.
 * Only a transferred MessagePort can communicate with the trusted host.
 * No allow-same-origin, network, top navigation or host DOM references.
 * Initial runtime supports self-contained ES modules only.
 */
const BOOTSTRAP = `
"use strict";
let channel = null;
let plugin = null;
window.addEventListener("message", async event => {
  if (channel || event.source !== parent ||
      event.data?.kind !== "cluster-plugin-bootstrap" ||
      event.ports.length !== 1) return;
  channel = event.ports[0];
  try {
    const source = event.data.source;
    if (typeof source !== "string") throw Error("Source missing");
    // No eval and no host-origin script URL; relative imports are
    // deliberately unsupported in the first secure runtime iteration.
    const url = "data:text/javascript;charset=utf-8," +
      encodeURIComponent(source);
    plugin = await import(url);
    channel.onmessage = async ({data}) => {
      if (data?.kind !== "invoke" ||
          !Number.isSafeInteger(data.id)) return;
      try {
        const fn = Object.hasOwn(plugin, data.action) ?
          plugin[data.action] : null;
        if (typeof fn !== "function") {
          channel.postMessage({kind:"response",id:data.id,
            ok:false,status:404});
          return;
        }
        const value = await fn(data.payload);
        channel.postMessage({kind:"response",id:data.id,
          ok:true,value:value ?? null});
      } catch (_error) {
        channel.postMessage({kind:"response",id:data.id,
          ok:false,status:500});
      }
    };
    channel.start();
    channel.postMessage({kind:"ready"});
  } catch (_error) {
    channel.postMessage({kind:"error",status:400});
  }
});
`;

const CSP = "default-src 'none'; script-src 'unsafe-inline' data:; " +
  "connect-src 'none'; img-src data:; style-src 'unsafe-inline'; " +
  "font-src 'none'; object-src 'none'; frame-src 'none'; " +
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
    this.port?.close();
    this.port = null;
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
        } else {
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
