import { PluginSession } from "../object/PluginSession.js";

/**
 * Host-only MessagePort/session association.
 * Never accept identity from the Worker handshake or RPC envelope.
 * The owning transport must also enforce its own live grant checks.
 */
export class PluginSessionUnit {
  #ports = new WeakMap();
  #sessions = new Map();

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
    return session ?
      session.inspect(port, packet) :
      { ok: false, status: 403, errorCode: "UNTRUSTED_PORT" };
  }

  revoke(sessionId) {
    const session = this.#sessions.get(sessionId);
    if (!session) return { ok: false, status: 404 };
    session.revoke();
    this.#sessions.delete(sessionId);
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
