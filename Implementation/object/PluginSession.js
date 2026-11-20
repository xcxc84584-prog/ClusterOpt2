import { PluginBidirectionalEnvelopePolicy as Envelope } from
  "../property/PluginBidirectionalEnvelopePolicy.js";
import { PluginMessagePolicy } from
  "../property/PluginMessagePolicy.js";

/**
 * Trusted host-owned session for exactly one transferred MessagePort.
 * The plugin may echo a challenge, but cannot choose its own identity.
 * Session records never persist across a page reload or Worker restart.
 */
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const MAX_REPLAY_IDS = 1024;

function fail(status, errorCode) {
  return Object.freeze({ ok: false, status, errorCode });
}

function validIdentity(identity) {
  return identity && ["providerId", "objectId"].every(key =>
    typeof identity[key] === "string" && ID.test(identity[key]));
}

export class PluginSession {
  #port;
  #identity;
  #challenge;
  #seen = new Set();
  #state = "handshake";

  constructor(port, identity, sessionId, challenge) {
    if (!port || typeof port.postMessage !== "function" ||
        typeof port.close !== "function" ||
        !validIdentity(identity) ||
        !ID.test(sessionId) || !ID.test(challenge)) {
      throw new TypeError("Invalid plugin session bootstrap");
    }
    this.#port = port;
    this.#challenge = challenge;
    this.#identity = Object.freeze({
      sessionId, providerId: identity.providerId,
      objectId: identity.objectId
    });
  }

  get sessionId() { return this.#identity.sessionId; }
  get state() { return this.#state; }
  get providerId() { return this.#identity.providerId; }
  get objectId() { return this.#identity.objectId; }

  owns(port) {
    return this.#state !== "revoked" && port === this.#port;
  }

  start() {
    if (this.#state !== "handshake") {
      return fail(409, "INVALID_SESSION_STATE");
    }
    this.#port.postMessage({
      kind: "cluster-session-hello",
      protocol: Envelope.protocol,
      sessionId: this.sessionId,
      challenge: this.#challenge
    });
    return Object.freeze({ ok: true, status: 200 });
  }

  ready(port, message) {
    if (!this.owns(port)) return fail(403, "UNTRUSTED_PORT");
    if (this.#state !== "handshake") {
      return fail(409, "INVALID_SESSION_STATE");
    }
    const parsed = PluginMessagePolicy.inspect(message);
    const value = parsed.value;
    if (!parsed.ok || !value || Array.isArray(value) ||
        Object.keys(value).length !== 3 ||
        value.kind !== "cluster-session-ready" ||
        value.protocol !== Envelope.protocol ||
        value.challenge !== this.#challenge) {
      return fail(403, "INVALID_HANDSHAKE");
    }
    this.#challenge = null;
    this.#state = "ready";
    return Object.freeze({ ok: true, status: 200 });
  }

  inspect(port, message) {
    if (!this.owns(port)) return fail(403, "UNTRUSTED_PORT");
    if (this.#state !== "ready") return fail(425, "SESSION_NOT_READY");
    const parsed = Envelope.bind(message, this.#identity);
    if (!parsed.ok) return parsed;
    if (parsed.value.direction !== "plugin-to-host" ||
        parsed.value.type !== "request") {
      return fail(400, "UNEXPECTED_MESSAGE_DIRECTION");
    }
    if (this.#seen.has(parsed.value.requestId)) {
      return fail(409, "REPLAYED_REQUEST");
    }
    if (this.#seen.size >= MAX_REPLAY_IDS) {
      this.revoke();
      return fail(429, "REPLAY_WINDOW_EXHAUSTED");
    }
    this.#seen.add(parsed.value.requestId);
    return parsed;
  }

  revoke(options = {}) {
    if (this.#state === "revoked") return;
    this.#state = "revoked";
    this.#seen.clear();
    this.#challenge = null;
    if (options.closePort !== false) this.#port.close();
  }
}
