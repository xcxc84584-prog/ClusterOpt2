/**
 * PR24 transport adapter for real MessagePort communication.
 * The caller must supply a host-owned Provider ID after URU registration.
 * Every received RPC is authenticated and routed through the gateway.
 */
export class PluginHostRequestTransport {
  constructor(gateway, maxInflight = 16) {
    if (!Number.isInteger(maxInflight) ||
        maxInflight < 1 || maxInflight > 64) {
      throw new TypeError("Invalid transport concurrency budget");
    }
    this.gateway = gateway;
    this.maxInflight = maxInflight;
    this.connections = new Map();
  }

  attach(port, providerId) {
    if (!port || this.connections.has(port) ||
        typeof port.addEventListener !== "function" ||
        typeof port.removeEventListener !== "function") {
      return { ok: false, status: 409 };
    }
    const started = this.gateway.create(port, providerId);
    if (!started.ok) return started;
    const entry = {
      sessionId: started.session.sessionId, inflight: 0,
      active: true, listener: null
    };
    entry.listener = event => {
      void this.#handle(port, entry, event.data);
    };
    this.connections.set(port, entry);
    port.addEventListener("message", entry.listener);
    port.start?.();
    return { ok: true, status: 201,
      sessionId: entry.sessionId };
  }

  async #handle(port, entry, packet) {
    if (!entry.active) return;
    if (packet?.kind === "cluster-session-ready") {
      const ready = this.gateway.ready(port, packet);
      if (!ready.ok) this.detach(port);
      return;
    }
    // Ignore the separate legacy Host -> Plugin invoke protocol.
    if (packet?.protocol !== "cluster.rpc/1") return;
    if (entry.inflight >= this.maxInflight) {
      this.gateway.core.omu.record("EHU", "PluginTransport",
        "RPC.Overloaded", 429);
      return;
    }
    entry.inflight++;
    try {
      const result = await this.gateway.receive(port, packet);
      if (entry.active && result.ok && result.value) {
        port.postMessage(result.value);
      }
    } catch {
      this.gateway.core.omu.record("EHU", "PluginTransport",
        "RPC.Failed", 502);
    } finally {
      entry.inflight--;
    }
  }

  detach(port) {
    const entry = this.connections.get(port);
    if (!entry) return false;
    entry.active = false;
    port.removeEventListener("message", entry.listener);
    this.connections.delete(port);
    this.gateway.revoke(entry.sessionId);
    return true;
  }

  detachAll() {
    for (const port of [...this.connections.keys()]) {
      this.detach(port);
    }
  }
}
