/**
 * PR23.2 — UI protocol v1 data-only contract.
 *
 * Validation and immutable metadata ONLY. It never authorizes a caller,
 * registers a provider, modifies DOM, or routes requests. HubUnit remains
 * the single routing and ACL authority; UICO will consume this in PR23.3.
 */
const ACTIONS = Object.freeze({
  "UI.List": "ui.read",
  "UI.Describe": "ui.read",
  "UI.GetState": "ui.read",
  "UI.GetProperty": "ui.read",
  "UI.Create": "ui.create.own",
  "UI.Update": "ui.update.own",
  "UI.Remove": "ui.update.own",
  "UI.Batch": "ui.update.own",
  "UI.SetVisibility": "ui.update.own",
  "UI.SetFocus": "ui.update.own",
  "UI.OpenWindow": "ui.window",
  "UI.CloseWindow": "ui.window",
  "UI.AddTab": "ui.window",
  "UI.RemoveTab": "ui.window",
  "UI.NavigatePluginView": "ui.navigation",
  "UI.Subscribe": "ui.read",
  "UI.Unsubscribe": "ui.read"
});

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;
const ACTION_ID = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);
const REQUEST_KEYS = new Set([
  "protocol", "requestId", "targetId", "action", "payload",
  "expectedRevision", "deadlineMs"
]);
const RESPONSE_KEYS = new Set([
  "requestId", "eventId", "status", "ok", "revision", "data", "error"
]);
const ERROR_KEYS = new Set(["code", "message", "details"]);
const MAX_BYTES = 65536;
const MAX_DEPTH = 12;
const MAX_KEYS = 256;

const freeze = (value) => {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(freeze));
  }
  if (record(value)) {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, freeze(v)])
    ));
  }
  return value;
};

function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function plain(value, depth = 0) {
  if (depth > MAX_DEPTH) return false;
  if (value === null || typeof value === "string" ||
      typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) {
    return value.length <= MAX_KEYS &&
      value.every(item => plain(item, depth + 1));
  }
  if (!record(value)) return false;
  const keys = Object.keys(value);
  if (keys.length > MAX_KEYS) return false;
  return keys.every(key => !FORBIDDEN.has(key) &&
    plain(value[key], depth + 1));
}

function sizeWithinLimit(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length <=
      MAX_BYTES;
  } catch {
    return false;
  }
}

function exactlyKnownKeys(value, allowed) {
  return Object.keys(value).every(key => allowed.has(key));
}

const validId = value => typeof value === "string" &&
  IDENTIFIER.test(value);
const validRevision = value => Number.isSafeInteger(value) &&
  value >= 0;

function validPayload(action, value) {
  if (!record(value)) return false;
  if (action === "UI.Create" || action === "UI.OpenWindow") {
    return typeof value.kind === "string" &&
      ["button", "window", "tab", "menu-item", "panel"].includes(value.kind) &&
      validId(value.parentId) && record(value.props) &&
      (value.onActivateAction === undefined ||
        ACTION_ID.test(value.onActivateAction));
  }
  if (action === "UI.Batch") {
    return Array.isArray(value.operations) &&
      value.operations.length > 0 && value.operations.length <= 50 &&
      value.operations.every(op => record(op) &&
        ["UI.Create", "UI.Update", "UI.Remove"].includes(op.action) &&
        validPayload(op.action, op.payload));
  }
  if (["UI.Update", "UI.Remove", "UI.Describe", "UI.GetState",
       "UI.GetProperty", "UI.SetVisibility", "UI.SetFocus",
       "UI.CloseWindow", "UI.AddTab", "UI.RemoveTab",
       "UI.NavigatePluginView", "UI.Subscribe",
       "UI.Unsubscribe"].includes(action)) {
    if (!validId(value.uiId)) return false;
  }
  if (action === "UI.Update") {
    return record(value.props);
  }
  if (action === "UI.GetProperty") {
    return validId(value.property);
  }
  if (action === "UI.SetVisibility") {
    return typeof value.visible === "boolean";
  }
  if (action === "UI.AddTab") {
    return validId(value.tabId) && typeof value.title === "string";
  }
  if (action === "UI.RemoveTab") {
    return validId(value.tabId);
  }
  if (action === "UI.NavigatePluginView") {
    return validId(value.viewId);
  }
  if (action === "UI.Subscribe" || action === "UI.Unsubscribe") {
    return validId(value.subscriptionId);
  }
  return true;
}

function failure(code, reason) {
  return Object.freeze({ ok: false, code, reason });
}

export const UIProtocolPolicy = Object.freeze({
  protocol: "cluster.ui/1",
  version: 1,
  maxBytes: MAX_BYTES,
  capabilities: ACTIONS,

  /**
   * Caller identity is intentionally ABSENT from this envelope:
   * HubUnit must bind it using the authenticated transport context.
   */
  validateRequest(request) {
    if (!record(request) || !plain(request) ||
        !sizeWithinLimit(request)) {
      return failure("UI_REQUEST_INVALID", "Non-plain or oversized request");
    }
    if (!exactlyKnownKeys(request, REQUEST_KEYS)) {
      return failure("UI_REQUEST_FIELDS", "Unknown envelope field");
    }
    if (request.protocol !== this.protocol ||
        !validId(request.requestId) ||
        request.targetId !== "UICO" ||
        !Object.hasOwn(ACTIONS, request.action)) {
      return failure("UI_REQUEST_HEADER", "Invalid protocol or action");
    }
    if (request.expectedRevision !== undefined &&
        !validRevision(request.expectedRevision)) {
      return failure("UI_REQUEST_REVISION", "Invalid expected revision");
    }
    if (request.deadlineMs !== undefined &&
        (!Number.isSafeInteger(request.deadlineMs) ||
         request.deadlineMs < 1 || request.deadlineMs > 30000)) {
      return failure("UI_REQUEST_DEADLINE", "Invalid deadline");
    }
    if (!validPayload(request.action, request.payload)) {
      return failure("UI_REQUEST_PAYLOAD", "Invalid action payload");
    }
    return Object.freeze({
      ok: true,
      capability: ACTIONS[request.action],
      value: freeze(request)
    });
  },

  validateResponse(response) {
    if (!record(response) || !plain(response) ||
        !sizeWithinLimit(response) ||
        !exactlyKnownKeys(response, RESPONSE_KEYS)) {
      return failure("UI_RESPONSE_INVALID", "Invalid response envelope");
    }
    if (!validId(response.requestId) ||
        !Number.isSafeInteger(response.eventId) ||
        response.eventId < 0 ||
        !Number.isInteger(response.status) ||
        response.status < 100 || response.status > 599 ||
        typeof response.ok !== "boolean") {
      return failure("UI_RESPONSE_HEADER", "Invalid response header");
    }
    if (response.revision !== undefined &&
        !validRevision(response.revision)) {
      return failure("UI_RESPONSE_REVISION", "Invalid revision");
    }
    if (response.ok) {
      if (response.status < 200 || response.status >= 300 ||
          response.error !== undefined) {
        return failure("UI_RESPONSE_STATUS", "Success/status mismatch");
      }
    } else {
      const err = response.error;
      if (response.status < 400 || !record(err) ||
          !exactlyKnownKeys(err, ERROR_KEYS) ||
          !validId(err.code) ||
          typeof err.message !== "string" ||
          err.message.length > 512) {
        return failure("UI_RESPONSE_ERROR", "Failure/status mismatch");
      }
    }
    return Object.freeze({ ok: true, value: freeze(response) });
  }
});
