import { CapabilityIdPolicy } from "./CapabilityIdPolicy.js";

/**
 * PR04.02: data-only bounded Route Table schema.
 * This policy does not activate routes, register providers or grant access.
 */
const MAX_BYTES = 32768;
const MAX_ROUTES = 32;
const MAX_PROVIDERS = 8;
const ACTION = /^[a-z][a-zA-Z0-9]{0,63}$/;
const OBJECT = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;
const ROUTE_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const MODES = new Set(["replace", "chain", "fanout", "observe"]);
const ORIGINS = new Set(["user", "agent"]);
const TABLE_KEYS = new Set(["schemaVersion", "routes"]);
const ROUTE_KEYS = new Set([
  "routeId", "service", "action", "mode", "providers",
  "sourceFilter", "priority", "timeoutMs"
]);
const FILTER_KEYS = new Set(["origins", "objects"]);
const DENIED = new Set(["__proto__", "prototype", "constructor"]);
const encoder = new TextEncoder();

function fail(error) {
  return Object.freeze({ ok: false, status: 400, error });
}

function plain(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null);
}

function dataOnly(value, depth = 0, ancestors = new Set()) {
  if (depth > 8) return false;
  if (value === null || typeof value === "string" ||
      typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value) ||
      (!plain(value) && !Array.isArray(value))) return false;
  const keys = Object.keys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const own = Reflect.ownKeys(value);
  if (keys.length > 128 || keys.some(key => DENIED.has(key))) {
    return false;
  }
  if (own.length !== keys.length + (Array.isArray(value) ? 1 : 0) ||
      (Array.isArray(value) && keys.length !== value.length)) return false;
  ancestors.add(value);
  const valid = keys.every(key =>
    Object.hasOwn(descriptors[key], "value") &&
    dataOnly(descriptors[key].value, depth + 1, ancestors));
  ancestors.delete(value);
  return valid;
}

function exact(value, keys) {
  return plain(value) && Object.keys(value).length === keys.size &&
    Object.keys(value).every(key => keys.has(key));
}

function boundedId(value, rule, max = 128) {
  return typeof value === "string" && value.length <= max &&
    rule.test(value) && !DENIED.has(value);
}

function unique(items) {
  return new Set(items).size === items.length;
}

function sourceFilterValid(value) {
  return exact(value, FILTER_KEYS) &&
    Array.isArray(value.origins) &&
    value.origins.length >= 1 && value.origins.length <= 2 &&
    value.origins.every(origin => ORIGINS.has(origin)) &&
    unique(value.origins) &&
    Array.isArray(value.objects) && value.objects.length <= 32 &&
    value.objects.every(id => boundedId(id, OBJECT)) &&
    unique(value.objects);
}

function routeValid(route) {
  if (!exact(route, ROUTE_KEYS) ||
      !boundedId(route.routeId, ROUTE_ID) ||
      !CapabilityIdPolicy.validate(route.service).ok ||
      !boundedId(route.action, ACTION, 64) ||
      !MODES.has(route.mode) ||
      !sourceFilterValid(route.sourceFilter) ||
      !Number.isInteger(route.priority) ||
      route.priority < -100 || route.priority > 100 ||
      !Number.isInteger(route.timeoutMs) ||
      route.timeoutMs < 1 || route.timeoutMs > 30000 ||
      !Array.isArray(route.providers) ||
      route.providers.length < 1 ||
      route.providers.length > MAX_PROVIDERS ||
      !route.providers.every(id =>
        CapabilityIdPolicy.validate(id).ok) ||
      !unique(route.providers)) return false;
  if (route.mode === "replace" && route.providers.length !== 1) {
    return false;
  }
  return true;
}

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value === null || typeof value !== "object") return value;
  const result = Object.create(null);
  for (const [key, item] of Object.entries(value)) {
    result[key] = freeze(item);
  }
  return Object.freeze(result);
}

export const RouteTablePolicy = Object.freeze({
  schemaVersion: 1,
  maxBytes: MAX_BYTES,
  maxRoutes: MAX_ROUTES,
  validate(candidate) {
    try {
      if (!dataOnly(candidate) || !exact(candidate, TABLE_KEYS) ||
          candidate.schemaVersion !== 1 ||
          !Array.isArray(candidate.routes) ||
          candidate.routes.length > MAX_ROUTES ||
          !candidate.routes.every(routeValid)) {
        return fail("Invalid Route Table schema");
      }
      const routeIds = candidate.routes.map(route => route.routeId);
      if (!unique(routeIds)) return fail("Duplicate Route ID");
      // A selector/priority collision is rejected even if filters differ.
      // Future PR04.03 defines deterministic scope/priority matching.
      const selectors = candidate.routes.map(route =>
        [route.service, route.action, route.priority].join(":"));
      if (!unique(selectors)) return fail("Conflicting Route selector");
      const json = JSON.stringify(candidate);
      if (encoder.encode(json).byteLength > MAX_BYTES) {
        return fail("Route Table exceeds byte budget");
      }
      return Object.freeze({
        ok: true, status: 200, value: freeze(JSON.parse(json))
      });
    } catch {
      return fail("Invalid Route Table data");
    }
  }
});
