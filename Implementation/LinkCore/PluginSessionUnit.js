import { PluginSession } from "../object/PluginSession.js";

/**
 * Host-only MessagePort/session association.
 * Never accept identity from the Worker handshake or RPC envelope.
 * The owning transport must also enforce its own live grant checks.
 */
export class PluginSessionUnit {
  #ports = new WeakMap();
  #sessions = new Map();
  #livePorts = new Map();

  constructor(randomUUID = () => crypto.randomUUID()) {
    this.randomUUID = randomUUID;
  }

  create(port, providerId, objectId) {
    if (!port || this.#ports.has(port)) {
      return { ok: false, status: 409 };
    }
    const sessionId = this.randomUUID();
    const challenge = this.randomUUID();
    if (this.#sessions.has(sessionId)) {
      return { ok: false, status: 409 };
    }
    let session;
    try {
      session = new PluginSession(port, { providerId, objectId },
        sessionId, challenge);
      session.start();
    } catch {
      return { ok: false, status: 400 };
    }
    this.#ports.set(port, session);
    this.#livePorts.set(sessionId, port);
    this.#sessions.set(sessionId, session);
    return { ok: true, status: 201, session };
  }

  ready(port, packet) {
    const session = this.#ports.get(port);
    return session ?
      session.ready(port, packet) :
      { ok: false, status: 403, errorCode: "UNTRUSTED_PORT" };
  }

  inspect(port, packet) {
    const session = this.#ports.get(port);
    if (!session) {
      return { ok: false, status: 403,
        errorCode: "UNTRUSTED_PORT" };
    }
    const result = session.inspect(port, packet);
    if (session.state === "revoked") {
      // The Session can self-revoke after replay budget exhaustion.
      // Clean the host indexes even without an explicit revoke() call.
      this.#sessions.delete(session.sessionId);
      this.#livePorts.delete(session.sessionId);
      this.#ports.delete(port);
    }
    return result;
  }

  revoke(sessionId, options = {}) {
    const session = this.#sessions.get(sessionId);
    if (!session) return { ok: false, status: 404 };
    session.revoke(options);
    this.#sessions.delete(sessionId);
    // The stale port must not retain authority across a new handshake.
    const port = this.#livePorts.get(sessionId);
    if (port) this.#ports.delete(port);
    this.#livePorts.delete(sessionId);
    return { ok: true, status: 200 };
  }

  revokeProvider(providerId) {
    let count = 0;
    for (const [id, session] of this.#sessions) {
      if (session.providerId !== providerId) continue;
      this.revoke(id);
      count++;
    }
    return count;
  }

  get activeCount() {
    return this.#sessions.size;
  }
}
