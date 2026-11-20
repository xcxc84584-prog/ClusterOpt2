/**
 * Host-side MessagePort adapter. Session identity never comes from Worker.
 * Suspension keeps the Worker port but destroys all previous authority.
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
      active: true, listener: null, controllers: new Set()
    };
    entry.listener = event => {
      void this.#handle(port, entry, event.data);
    };
    this.connections.set(port, entry);
    port.addEventListener("message", entry.listener);
    port.start?.();
    return { ok: true, status: 201, sessionId: entry.sessionId };
  }

  async #handle(port, entry, packet) {
    if (!entry.active) return;
    if (packet?.kind === "cluster-session-ready") {
      const ready = this.gateway.ready(port, packet);
      if (!ready.ok) this.detach(port);
      return;
    }
    // Never take over the legacy invoke/response message channel.
    if (packet?.protocol !== "cluster.rpc/1") return;
    if (entry.inflight >= this.maxInflight) {
      this.gateway.core.omu.record("EHU", "PluginTransport",
        "RPC.Overloaded", 429);
      return;
    }
    const controller = new AbortController();
    entry.controllers.add(controller);
    entry.inflight++;
    try {
      const result = await this.gateway.receive(port, packet,
        { signal: controller.signal });
      if (entry.active && !controller.signal.aborted &&
          result.ok && result.value) {
        port.postMessage(result.value);
      }
    } catch {
      this.gateway.core.omu.record("EHU", "PluginTransport",
        "RPC.Failed", 502);
    } finally {
      entry.controllers.delete(controller);
      entry.inflight--;
    }
  }

  #remove(port, closePort, notify) {
    const entry = this.connections.get(port);
    if (!entry) return false;
    // Disable new messages before cancellation of pending calls.
    entry.active = false;
    port.removeEventListener("message", entry.listener);
    this.connections.delete(port);
    if (notify) {
      try {
        port.postMessage({
          kind: "cluster-session-suspended",
          protocol: "cluster.rpc/1"
        });
      } catch {
        // Failure to notify does not preserve any host-side authority.
      }
    }
    for (const controller of entry.controllers) controller.abort();
    this.gateway.revoke(entry.sessionId, { closePort });
    return true;
  }

  suspend(port) {
    return this.#remove(port, false, true);
  }

  resume(port, providerId) {
    return this.attach(port, providerId);
  }

  detach(port) {
    return this.#remove(port, true, false);
  }

  detachAll() {
    for (const port of [...this.connections.keys()]) {
      this.detach(port);
    }
  }
}
