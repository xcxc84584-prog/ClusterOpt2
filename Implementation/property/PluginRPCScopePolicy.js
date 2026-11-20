/**
 * PR24.41: immutable exact-match scopes for untrusted reverse RPC.
 * A declaration is only intent; host consent and live Hub ACL are
 * separate gates. No wildcards, prefixes, or implied descendants.
 */
const TARGET = /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*$/;
const ACTION = /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*$/;
const PROPERTY = /^[A-Za-z][A-Za-z0-9_]{0,127}$/;
const MAX_SCOPES = 32;
const MAX_TARGET = 192;
const MAX_ACTION = 96;
const FIELDS = new Set(["target", "action", "property"]);

function deny(status, errorCode) {
  return Object.freeze({ ok: false, status, errorCode });
}

function scopeKey(value) {
  return value.target + "\u0000" + value.action +
    "\u0000" + (value.property ?? "");
}

function plainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  const keys = Reflect.ownKeys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return keys.every(key => typeof key === "string" &&
    FIELDS.has(key) && Object.hasOwn(descriptors[key], "value"));
}

function validScope(value) {
  if (!plainRecord(value) ||
      typeof value.target !== "string" ||
      value.target.length > MAX_TARGET || !TARGET.test(value.target) ||
      typeof value.action !== "string" ||
      value.action.length > MAX_ACTION || !ACTION.test(value.action)) {
    return false;
  }
  const propertyRead = value.target === "HubUnit" &&
    value.action === "Property.Read";
  if (value.target === "HubUnit" && !propertyRead) return false;
  if (propertyRead) {
    return typeof value.property === "string" &&
      PROPERTY.test(value.property);
  }
  return !Object.hasOwn(value, "property");
}

export const PluginRPCScopePolicy = Object.freeze({
  inspect(candidate) {
    if (!Array.isArray(candidate) ||
        candidate.length > MAX_SCOPES ||
        !candidate.every(validScope)) {
      return deny(400, "INVALID_RPC_SCOPES");
    }
    const scopes = candidate.map(item => Object.freeze({
      target: item.target, action: item.action,
      ...(item.property === undefined ? {} : {
        property: item.property
      })
    }));
    if (new Set(scopes.map(scopeKey)).size !== scopes.length) {
      return deny(400, "DUPLICATE_RPC_SCOPE");
    }
    return Object.freeze({
      ok: true, status: 200, value: Object.freeze(scopes)
    });
  },

  review(declared, approved) {
    const wanted = this.inspect(declared);
    const granted = this.inspect(approved);
    if (!wanted.ok || !granted.ok) {
      return deny(400, "INVALID_RPC_APPROVAL");
    }
    const keys = new Set(granted.value.map(scopeKey));
    if (keys.size !== wanted.value.length ||
        !wanted.value.every(scope => keys.has(scopeKey(scope)))) {
      return deny(403, "RPC_SCOPE_CONSENT_REQUIRED");
    }
    return granted;
  },

  allows(scopes, target, action, payload) {
    if (target === "HubUnit" && action === "Property.Read") {
      if (!payload || typeof payload !== "object" ||
          Array.isArray(payload) ||
          Object.keys(payload).length !== 1 ||
          typeof payload.name !== "string") return false;
      return scopes.some(scope => scope.target === target &&
        scope.action === action && scope.property === payload.name);
    }
    if (target === "HubUnit") return false;
    return scopes.some(scope => scope.target === target &&
      scope.action === action && !Object.hasOwn(scope, "property"));
  }
});
