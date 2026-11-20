import { PluginBidirectionalEnvelopePolicy as Envelope } from
  "../property/PluginBidirectionalEnvelopePolicy.js";

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

  /**
   * Host-only revocation. Abort only matching in-flight requests, send
   * a correlated 403, and keep reservations until Host work settles.
   * The Gateway retains revoked scopes after disable/enable rekey.
   */
  revokeRpcScope(scope) {
    const revoked = this.gateway.revokeRpcScope(scope);
    if (!revoked.ok) return revoked;
    let cancelled = 0;
    for (const [port, entry] of this.connections) {
      for (const [requestId, task] of entry.requests) {
        if (task.controller.signal.aborted ||
            task.target !== scope.target || task.action !== scope.action ||
            task.property !== scope.property) continue;
        task.controller.abort();
        cancelled++;
        const audit = this.gateway.core.omu.record("EHU",
          "PluginTransport", "RPC.ScopeRevokedInflight", 403,
          task.target, { requestId });
        const checked = Envelope.inspect({
          protocol: Envelope.protocol, direction: "plugin-to-host",
          type: "response", requestId, eventId: audit.eventId,
          status: 403, ok: false,
          error: { code: "RPC_SCOPE_REVOKED",
            message: "RPC scope revoked by host" }
        });
        if (checked.ok && entry.active) {
          try { port.postMessage(checked.value); }
          catch { /* Revocation stays authoritative if port is gone. */ }
        }
      }
    }
    return { ok: true, status: 200, cancelled };
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
      active: true, listener: null, controllers: new Set(),
      requests: new Map()
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
      if (!ready.ok) {
        // An ACK from a suspended predecessor can arrive after
        // Session rotation. It grants nothing; retain the new
        // handshake until its own challenge is confirmed.
        this.gateway.core.omu.record("EHU", "PluginTransport",
          "RPC.HandshakeRejected", ready.status ?? 403);
      }
      return;
    }
    // Never take over the legacy invoke/response message channel.
    if (packet?.protocol !== "cluster.rpc/1") return;
    const validated = Envelope.inspect(packet);
    if (validated.ok && validated.value.type === "cancel" &&
        validated.value.direction === "plugin-to-host") {
      const task = entry.requests.get(validated.value.requestId);
      if (task) {
        task.controller.abort();
        this.gateway.core.omu.record("EHU", "PluginTransport",
          "RPC.Cancelled", 499, "", {
            requestId: validated.value.requestId
          });
      }
      return;
    }
    if (entry.inflight >= this.maxInflight) {
      const audit = this.gateway.core.omu.record("EHU",
        "PluginTransport", "RPC.Overloaded", 429);
      if (validated.ok && validated.value.type === "request" &&
          validated.value.direction === "plugin-to-host") {
        const response = {
          protocol: Envelope.protocol, direction: "plugin-to-host",
          type: "response", requestId: validated.value.requestId,
          eventId: audit.eventId, status: 429, ok: false,
          error: { code: "RPC_BACKPRESSURE", message: "Busy" }
        };
        try {
          port.postMessage(response);
        } catch {
          // The transport remains fail-closed on disconnected ports.
        }
      }
      return;
    }
    const controller = new AbortController();
    const requestId = validated.ok &&
      validated.value.type === "request" &&
      validated.value.direction === "plugin-to-host" ?
      validated.value.requestId : null;
    if (requestId && entry.requests.has(requestId)) {
      this.gateway.core.omu.record("EHU", "PluginTransport",
        "RPC.DuplicateInflight", 409);
      return;
    }
    if (requestId) {
      entry.requests.set(requestId, {
        controller, target: validated.value.target,
        action: validated.value.action,
        property: validated.value.target === "HubUnit" &&
          validated.value.action === "Property.Read" ?
          validated.value.payload?.name : undefined
      });
    }
    // Deadline covers the whole host-side request, not just scheduling.
    const deadlineMs = requestId ?
      (validated.value.deadlineMs ?? 5000) : 5000;
    const timeout = setTimeout(() => {
      // A non-cooperative Host Object may ignore AbortSignal. Send the
      // caller a bounded, correlated failure without waiting for it.
      // Retain the in-flight reservation until the Host work settles.
      if (controller.signal.aborted) return;
      controller.abort();
      if (!entry.active || !requestId) return;
      const audit = this.gateway.core.omu.record("EHU",
        "PluginTransport", "RPC.DeadlineExceeded", 504, "", {
          requestId
        });
      const response = Envelope.inspect({
        protocol: Envelope.protocol, direction: "plugin-to-host",
        type: "response", requestId, eventId: audit.eventId,
        status: 504, ok: false,
        error: { code: "RPC_TIMEOUT", message: "Deadline exceeded" }
      });
      if (!response.ok) return;
      try {
        port.postMessage(response.value);
      } catch {
        // Failure to deliver never reauthorizes a stale Host result.
      }
    }, deadlineMs);
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
      clearTimeout(timeout);
      entry.controllers.delete(controller);
      if (requestId) entry.requests.delete(requestId);
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
