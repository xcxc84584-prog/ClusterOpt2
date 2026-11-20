import { PluginMessagePolicy } from "./PluginMessagePolicy.js";

/**
 * PR24.03-09: transport-neutral, data-only bidirectional RPC contract.
 * Validation never establishes identity or grants a capability.
 * Session identity must be pinned by the owning MessagePort adapter.
 */
const VERSION = "cluster.rpc/1";
const DIRECTIONS = new Set(["plugin-to-host", "host-to-plugin"]);
const TYPES = new Set(["request", "response", "cancel"]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const PATH_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,191}$/;
const ACTION_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,95}$/;
const MAX_DEADLINE_MS = 30000;
const REQUEST_FIELDS = new Set([
  "protocol", "direction", "type", "requestId",
  "target", "action", "payload", "parentEventId",
  "deadlineMs"
]);
const RESPONSE_FIELDS = new Set([
  "protocol", "direction", "type", "requestId",
  "eventId", "parentEventId", "status", "ok", "data",
  "error"
]);
const CANCEL_FIELDS = new Set([
  "protocol", "direction", "type", "requestId", "reason"
]);

function failure(status, errorCode) {
  return Object.freeze({ ok: false, status, errorCode });
}

function keysMatch(value, allowed, required) {
  return required.every(key => Object.hasOwn(value, key)) &&
    Object.keys(value).every(key => allowed.has(key));
}

function validId(value) {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function validEvent(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validDirection(value) {
  return DIRECTIONS.has(value);
}

function validError(error) {
  return error && typeof error === "object" &&
    !Array.isArray(error) &&
    keysMatch(error, new Set(["code", "message"]),
      ["code", "message"]) &&
    validId(error.code) &&
    typeof error.message === "string" &&
    error.message.length <= 256;
}

export const PluginBidirectionalEnvelopePolicy = Object.freeze({
  protocol: VERSION,
  maxBytes: PluginMessagePolicy.maxBytes,
  maxDeadlineMs: MAX_DEADLINE_MS,

  inspect(candidate) {
    const parsed = PluginMessagePolicy.inspect(candidate);
    if (!parsed.ok) {
      return failure(parsed.status,
        parsed.status === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_PAYLOAD");
    }
    const value = parsed.value;
    if (!value || Array.isArray(value) ||
        value.protocol !== VERSION ||
        !validDirection(value.direction) ||
        !TYPES.has(value.type) ||
        !validId(value.requestId)) {
      return failure(400, "INVALID_ENVELOPE");
    }

    if (value.type === "request") {
      if (!keysMatch(value, REQUEST_FIELDS, [
        "protocol", "direction", "type", "requestId",
        "target", "action", "payload"
      ]) ||
          typeof value.target !== "string" ||
          !PATH_PATTERN.test(value.target) ||
          typeof value.action !== "string" ||
          !ACTION_PATTERN.test(value.action) ||
          (value.parentEventId !== undefined &&
            !validEvent(value.parentEventId)) ||
          (value.deadlineMs !== undefined &&
            (!Number.isSafeInteger(value.deadlineMs) ||
              value.deadlineMs < 1 ||
              value.deadlineMs > MAX_DEADLINE_MS))) {
        return failure(400, "INVALID_REQUEST");
      }
    }

    if (value.type === "response") {
      if (!keysMatch(value, RESPONSE_FIELDS, [
        "protocol", "direction", "type", "requestId",
        "eventId", "status", "ok"
      ]) ||
          !validEvent(value.eventId) ||
          (value.parentEventId !== undefined &&
            !validEvent(value.parentEventId)) ||
          !Number.isInteger(value.status) ||
          value.status < 200 || value.status > 599 ||
          typeof value.ok !== "boolean" ||
          value.ok !== (value.status < 400) ||
          (value.ok && (value.error !== undefined ||
            !Object.hasOwn(value, "data"))) ||
          (!value.ok && (value.data !== undefined ||
            !validError(value.error)))) {
        return failure(400, "INVALID_RESPONSE");
      }
    }

    if (value.type === "cancel" &&
        (!keysMatch(value, CANCEL_FIELDS, [
          "protocol", "direction", "type", "requestId"
        ]) ||
          (value.reason !== undefined &&
            (typeof value.reason !== "string" ||
              value.reason.length > 128)))) {
      return failure(400, "INVALID_CANCEL");
    }

    return Object.freeze({ ok: true, status: 200, value });
  },

  /**
   * Reject identity claims in the untrusted envelope. The transport
   * must attach trusted session/provider identity out of band.
   */
  bind(candidate, trusted) {
    const parsed = this.inspect(candidate);
    if (!parsed.ok) return parsed;
    if (!trusted || !validId(trusted.sessionId) ||
        !validId(trusted.providerId) ||
        !validId(trusted.objectId) ||
        !Object.isFrozen(trusted)) {
      return failure(403, "UNTRUSTED_SESSION");
    }
    return Object.freeze({
      ok: true,
      status: 200,
      session: trusted,
      value: parsed.value
    });
  }
});
