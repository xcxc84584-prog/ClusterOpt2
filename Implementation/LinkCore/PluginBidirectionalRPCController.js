import { PluginBidirectionalEnvelopePolicy as Envelope } from
  "../property/PluginBidirectionalEnvelopePolicy.js";

/**
 * PR24: transport-neutral host RPC controller.
 * A trusted transport supplies the actual port and its host-owned session.
 * This unit does not register providers, grant permissions or bypass HubUnit.
 */
function failure(status, errorCode) {
  return Object.freeze({ ok: false, status, errorCode });
}

const MAX_ACTIVE = 16;
const MAX_QUEUE = 64;

export class PluginBidirectionalRPCController {
  #pending = new Map();
  #queue = [];
  #sequence = 0;
  #closed = false;

  constructor(options = {}) {
    this.maxActive = options.maxActive ?? MAX_ACTIVE;
    this.maxQueue = options.maxQueue ?? MAX_QUEUE;
    this.timeoutMs = options.timeoutMs ?? 5000;
    if (!Number.isSafeInteger(this.maxActive) ||
        this.maxActive < 1 || this.maxActive > 64 ||
        !Number.isSafeInteger(this.maxQueue) ||
        this.maxQueue < 0 || this.maxQueue > 256 ||
        !Number.isSafeInteger(this.timeoutMs) ||
        this.timeoutMs < 1 || this.timeoutMs > Envelope.maxDeadlineMs) {
      throw new TypeError("Invalid RPC resource budget");
    }
  }

  get pendingCount() { return this.#pending.size; }
  get queuedCount() { return this.#queue.length; }

  #eligible(port, session) {
    return !this.#closed && session?.state === "ready" &&
      session.owns(port);
  }

  /**
   * Host -> Plugin: in-flight requests are mapped to their originating
   * port and session, preventing replies from another plugin or session.
   */
  request(port, session, target, action, payload, options = {}) {
    if (!this.#eligible(port, session)) {
      return Promise.resolve(failure(403, "SESSION_NOT_READY"));
    }
    const deadlineMs = options.deadlineMs ?? this.timeoutMs;
    const packet = {
      protocol: Envelope.protocol,
      direction: "host-to-plugin",
      type: "request",
      requestId: "host-" + ++this.#sequence,
      target, action, payload,
      deadlineMs
    };
    const checked = Envelope.inspect(packet);
    if (!checked.ok) return Promise.resolve(checked);
    const requestId = packet.requestId;
    if (this.#pending.size + this.#queue.length >=
        this.maxActive + this.maxQueue) {
      return Promise.resolve(failure(429, "RPC_BACKPRESSURE"));
    }
    return new Promise(resolve => {
      const task = {
        port, session, packet: checked.value, resolve,
        started: false, timer: null
      };
      this.#pending.set(requestId, task);
      this.#queue.push(requestId);
      this.#drain();
    });
  }

  #drain() {
    let running = 0;
    for (const entry of this.#pending.values()) {
      if (entry.started) running++;
    }
    while (running < this.maxActive && this.#queue.length) {
      const id = this.#queue.shift();
      const task = this.#pending.get(id);
      if (!task) continue;
      if (!this.#eligible(task.port, task.session)) {
        this.#settle(id, failure(499, "SESSION_REVOKED"));
        continue;
      }
      task.started = true;
      running++;
      task.timer = setTimeout(() => {
        this.#settle(id, failure(504, "RPC_TIMEOUT"));
      }, task.packet.deadlineMs);
      try {
        task.port.postMessage(task.packet);
      } catch {
        this.#settle(id, failure(502, "TRANSPORT_FAILED"));
      }
    }
  }

  #settle(id, result) {
    const task = this.#pending.get(id);
    if (!task) return false;
    this.#pending.delete(id);
    if (task.timer !== null) clearTimeout(task.timer);
    const index = this.#queue.indexOf(id);
    if (index >= 0) this.#queue.splice(index, 1);
    task.resolve(result);
    this.#drain();
    return true;
  }

  receive(port, session, packet) {
    if (!this.#eligible(port, session)) {
      return failure(403, "UNTRUSTED_PORT");
    }
    const parsed = Envelope.inspect(packet);
    if (!parsed.ok) return parsed;
    const value = parsed.value;
    if (value.direction !== "host-to-plugin" ||
        value.type !== "response") {
      return failure(400, "UNEXPECTED_RESPONSE");
    }
    const task = this.#pending.get(value.requestId);
    if (!task || !task.started) {
      return failure(409, "UNKNOWN_REQUEST");
    }
    if (task.port !== port || task.session !== session) {
      return failure(403, "RESPONSE_SESSION_MISMATCH");
    }
    this.#settle(value.requestId, value.ok ?
      Object.freeze({ ok: true, status: value.status,
        eventId: value.eventId, data: value.data }) :
      failure(value.status, value.error.code));
    return Object.freeze({ ok: true, status: 200 });
  }

  cancel(requestId, reason = "CANCELLED") {
    const task = this.#pending.get(requestId);
    if (!task) return failure(404, "UNKNOWN_REQUEST");
    if (task.started && this.#eligible(task.port, task.session)) {
      try {
        task.port.postMessage({
          protocol: Envelope.protocol,
          direction: "host-to-plugin",
          type: "cancel", requestId, reason
        });
      } catch {
        // Best effort: cancellation locally settles even if transport fails.
      }
    }
    this.#settle(requestId, failure(499, "RPC_CANCELLED"));
    return Object.freeze({ ok: true, status: 200 });
  }

  revokeSession(session) {
    let count = 0;
    for (const [id, task] of [...this.#pending]) {
      if (task.session !== session) continue;
      this.#settle(id, failure(499, "SESSION_REVOKED"));
      count++;
    }
    return count;
  }

  close() {
    this.#closed = true;
    for (const id of [...this.#pending.keys()]) {
      this.#settle(id, failure(499, "RPC_CLOSED"));
    }
  }
}
