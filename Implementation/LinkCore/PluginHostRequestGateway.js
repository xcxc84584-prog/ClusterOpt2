import { PluginSessionUnit } from "./PluginSessionUnit.js";
import { PluginRPCScopePolicy as Scopes } from
  "../property/PluginRPCScopePolicy.js";
import { PluginBidirectionalEnvelopePolicy as Envelope } from
  "../property/PluginBidirectionalEnvelopePolicy.js";

/**
 * PR24: host-only, port-bound reverse request gateway.
 * Caller identities come from PluginSessionUnit, not Worker payloads.
 * URU owns provider identity, HubUnit owns request permissions.
 */
export class PluginHostRequestGateway {
  #activeRpcScopes;
  #reviewedRpcScopes;
  #ownerProviderId = null;
  #ownerObjectId = null;

  constructor(core, sessions = new PluginSessionUnit(),
    activeRpcScopes = [], reviewedRpcScopes = activeRpcScopes) {
    const active = Scopes.inspect(activeRpcScopes);
    const reviewed = Scopes.inspect(reviewedRpcScopes);
    const contains = (scopes, value) => scopes.some(item =>
      item.target === value.target &&
      item.action === value.action &&
      item.property === value.property);
    if (!active.ok || !reviewed.ok ||
        active.value.some(item => !contains(reviewed.value, item))) {
      throw new TypeError("Invalid Host-reviewed RPC scopes");
    }
    this.core = core;
    this.sessions = sessions;
    // Reviewed routes are NOT active grants. A durable deny keeps
    // them inactive until a separate Host-confirmed reapproval.
    this.#activeRpcScopes = active.value;
    this.#reviewedRpcScopes = reviewed.value;
  }

  listRpcScopes() {
    // The result is a frozen snapshot. Only the Host can revoke a scope.
    return this.#activeRpcScopes;
  }

  /**
   * Host-only reapproval. This is allowed only for a scope that was
   * explicitly reviewed for this Bridge at installation. The caller
   * must suspend the Session and commit the persistent deny removal
   * before any Worker traffic resumes.
   */
  grantReviewedRpcScope(scope) {
    const checked = Scopes.inspect([scope]);
    if (!checked.ok) return { ok: false, status: 400 };
    const candidate = checked.value[0];
    const exact = entry =>
      entry.target === candidate.target &&
      entry.action === candidate.action &&
      entry.property === candidate.property;
    if (!this.#reviewedRpcScopes.some(exact)) {
      return { ok: false, status: 403 };
    }
    if (this.#activeRpcScopes.some(exact)) {
      return { ok: false, status: 409 };
    }
    this.#activeRpcScopes = Object.freeze([
      ...this.#activeRpcScopes, candidate
    ]);
    this.core.omu.record("Log", "PluginGateway",
      "RPC.ScopeReapproved", 200, candidate.target, {
        action: candidate.action,
        property: candidate.property ?? null
      });
    return { ok: true, status: 200 };
  }

  revokeRpcScope(scope) {
    const checked = Scopes.inspect([scope]);
    if (!checked.ok) return { ok: false, status: 400 };
    const target = checked.value[0];
    const index = this.#activeRpcScopes.findIndex(item =>
      item.target === target.target && item.action === target.action &&
      item.property === target.property);
    if (index < 0) return { ok: false, status: 404 };
    this.#activeRpcScopes = Object.freeze(
      this.#activeRpcScopes.filter((_item, i) => i !== index));
    this.core.omu.record("Log", "PluginGateway",
      "RPC.ScopeRevoked", 200, target.target, {
        action: target.action, property: target.property ?? null
      });
    return { ok: true, status: 200 };
  }

  #denied(session, value, action = "RPC.ScopeRejected") {
    const audit = this.core.omu.record("EHU", session.objectId,
      action, 403, value.target, { requestId: value.requestId });
    const response = Envelope.inspect({
      protocol: Envelope.protocol, direction: "plugin-to-host",
      type: "response", requestId: value.requestId,
      eventId: audit.eventId, status: 403, ok: false,
      error: { code: "REQUEST_DENIED", message: "Access denied" }
    });
    return { ok: true, status: 200, value: response.value };
  }

  create(port, providerId) {
    const provider = this.core.uru.getProvider(providerId);
    if (!provider ||
        !this.core.uru.objects.has(provider.objectId) ||
        this.core.uru.disabledProviders.has(providerId)) {
      return { ok: false, status: 403 };
    }
    // One Host Gateway belongs to exactly one Provider/Object lifetime.
    // A second Worker Port for the same Provider is allowed, but a
    // different Provider cannot borrow the first owner's scopes.
    if (this.#ownerProviderId !== null &&
        (providerId !== this.#ownerProviderId ||
          provider.objectId !== this.#ownerObjectId)) {
      this.core.omu.record("EHU", "PluginGateway",
        "RPC.ForeignProviderRejected", 403, providerId);
      return { ok: false, status: 403 };
    }
    const created = this.sessions.create(
      port, providerId, provider.objectId);
    if (created.ok && this.#ownerProviderId === null) {
      this.#ownerProviderId = providerId;
      this.#ownerObjectId = provider.objectId;
    }
    return created;
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
      return this.#denied(session, value, "RPC.PermissionRejected");
    }
    if (!Scopes.allows(this.#activeRpcScopes,
      value.target, value.action, value.payload)) {
      return this.#denied(session, value);
    }

    const event = this.core.omu.record("Log", session.objectId,
      "RPC.Request." + session.sessionId + "." + value.requestId,
      202, value.target,
      { requestId: value.requestId,
        parentEventId: value.parentEventId ?? null });
    // Property.Read stays within HubUnit's EDPMU visibility gate.
    // It cannot be turned into an arbitrary Host method invocation.
    const result = value.target === "HubUnit" ?
      this.core.hub.readProperty(session.objectId, value.payload.name) :
      await this.core.hub.request(
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
        session.state !== "ready" || !stillAllowed ||
        !Scopes.allows(this.#activeRpcScopes,
          value.target, value.action, value.payload)) {
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
