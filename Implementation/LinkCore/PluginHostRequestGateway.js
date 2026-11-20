import { PluginSessionUnit } from "./PluginSessionUnit.js";
import { PluginBidirectionalEnvelopePolicy as Envelope } from
  "../property/PluginBidirectionalEnvelopePolicy.js";

/**
 * PR24: host-only, port-bound reverse request gateway.
 * Caller identities come from PluginSessionUnit, not Worker payloads.
 * URU owns provider identity, HubUnit owns request permissions.
 */
export class PluginHostRequestGateway {
  constructor(core, sessions = new PluginSessionUnit()) {
    this.core = core;
    this.sessions = sessions;
  }

  create(port, providerId) {
    const provider = this.core.uru.getProvider(providerId);
    if (!provider ||
        !this.core.uru.objects.has(provider.objectId) ||
        this.core.uru.disabledProviders.has(providerId)) {
      return { ok: false, status: 403 };
    }
    return this.sessions.create(port, providerId, provider.objectId);
  }

  ready(port, packet) {
    return this.sessions.ready(port, packet);
  }

  async receive(port, packet, options = {}) {
    const parsed = this.sessions.inspect(port, packet);
    if (!parsed.ok) {
      this.core.omu.record("EHU", "PluginGateway",
        "RPC.Rejected", parsed.status, "",
        { errorCode: parsed.errorCode ?? "INVALID_SESSION" });
      return { ok: false, status: parsed.status };
    }
    const { session, value } = parsed;
    const provider = this.core.uru.getProvider(session.providerId);
    const active = provider &&
      provider.objectId === session.objectId &&
      this.core.uru.objects.has(session.objectId) &&
      !this.core.uru.disabledProviders.has(session.providerId);
    const grants = active && provider.permissions.every(permission =>
      this.core.checkPluginPermission(session.providerId, permission));
    if (!active || !grants) {
      const audit = this.core.omu.record("EHU", session.objectId,
        "RPC.PermissionRejected", 403, value.target,
        { requestId: value.requestId });
      const denied = Envelope.inspect({
        protocol: Envelope.protocol,
        direction: "plugin-to-host",
        type: "response", requestId: value.requestId,
        eventId: audit.eventId, status: 403, ok: false,
        error: { code: "REQUEST_DENIED", message: "Access denied" }
      });
      return { ok: true, status: 200, value: denied.value };
    }

    const event = this.core.omu.record("Log", session.objectId,
      "RPC.Request." + session.sessionId + "." + value.requestId,
      202, value.target,
      { requestId: value.requestId,
        parentEventId: value.parentEventId ?? null });
    const result = await this.core.hub.request(
      session.objectId, value.target, value.action, value.payload,
      { origin: "user", signal: options.signal });
    // A disabled or replaced Session cannot publish a stale Response.
    const latest = this.core.uru.getProvider(session.providerId);
    const stillAllowed = latest &&
      latest.objectId === session.objectId &&
      !this.core.uru.disabledProviders.has(session.providerId) &&
      latest.permissions.every(permission =>
        this.core.checkPluginPermission(session.providerId, permission));
    if (options.signal?.aborted || !session.owns(port) ||
        session.state !== "ready" || !stillAllowed) {
      this.core.omu.record("EHU", session.objectId,
        "RPC.DiscardedAfterRevoke", 499, value.target,
        { requestId: value.requestId });
      return { ok: false, status: 499, errorCode: "SESSION_REVOKED" };
    }
    const status = Number.isInteger(result.status) ?
      result.status : 500;
    const details = {
      requestId: value.requestId,
      parentEventId: event?.eventId ?? value.parentEventId ?? null
    };
    const responseEvent = this.core.omu.record(
      result.ok ? "Log" : "EHU",
      session.objectId, "RPC.Response." + session.sessionId +
        "." + value.requestId, status, value.target, details);
    const response = {
      protocol: Envelope.protocol,
      direction: "plugin-to-host",
      type: "response",
      requestId: value.requestId,
      eventId: responseEvent?.eventId ?? event.eventId,
      parentEventId: event.eventId,
      status,
      ok: result.ok === true
    };
    if (result.ok) response.data = result.value ?? null;
    else response.error = {
      code: "REQUEST_DENIED",
      message: "Host request failed"
    };
    const checked = Envelope.inspect(response);
    if (!checked.ok) {
      this.core.omu.record("EHU", session.objectId,
        "RPC.InvalidResponse", 502, value.target, details);
      return { ok: false, status: 502 };
    }
    return { ok: true, status: 200, value: checked.value };
  }

  revoke(sessionId, options = {}) {
    return this.sessions.revoke(sessionId, options);
  }

  revokeProvider(providerId) {
    return this.sessions.revokeProvider(providerId);
  }
}
