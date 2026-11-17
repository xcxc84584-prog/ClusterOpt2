import { APIDescriptorPolicy } from "./APIDescriptorPolicy.js";
import { CapabilityIdPolicy } from "./CapabilityIdPolicy.js";
import { CatalogVersionPolicy } from "./CatalogVersionPolicy.js";

/**
 * PR03.02: bounded, immutable, DATA-ONLY provider declaration.
 * Validation does not register a provider or authorize any capability.
 */
const MAX_BYTES = 32768;
const MAX_ENTRIES = 32;
const MAX_DEPTH = 10;
const MAX_KEYS = 128;
const KEYS = new Set([
  "manifestVersion", "providerId", "objectId", "provides",
  "requires", "permissions", "execution"
]);
const PROVIDED = new Set([
  "service", "action", "version", "inputSchema", "outputSchema"
]);
const EXECUTION = new Set(["isolation", "concurrency"]);
const ISOLATION = new Set(["worker", "host"]);
const CONCURRENCY = new Set(["serial", "per-slice", "parallel"]);
const OBJECT_ID = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;
const ACTION = /^[a-z][a-zA-Z0-9]*$/;
const BANNED = new Set(["__proto__", "prototype", "constructor"]);
const encoder = new TextEncoder();

function fail(reason) {
  return Object.freeze({ ok: false, status: 400, error: reason });
}

function record(value) {
  if (!value || typeof value !== "object" ||
      Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function dataTree(value, depth = 0, seen = new Set()) {
  if (depth > MAX_DEPTH) return false;
  if (value === null || typeof value === "string" ||
      typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  if (!Array.isArray(value) && !record(value)) return false;
  seen.add(value);
  const keys = Object.keys(value);
  if (keys.length > MAX_KEYS ||
      (!Array.isArray(value) && keys.some(key => BANNED.has(key)))) {
    return false;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(value);
  if (Array.isArray(value)) {
    if (keys.length !== value.length ||
        ownKeys.length !== keys.length + 1) return false;
  } else if (ownKeys.length !== keys.length) {
    return false;
  }
  const valid = keys.every(key => {
    const property = descriptors[key];
    return Object.hasOwn(property, "value") &&
      dataTree(property.value, depth + 1, seen);
  });
  seen.delete(value);
  return valid;
}

function fields(value, allowed) {
  return record(value) &&
    Object.keys(value).every(key => allowed.has(key));
}

function list(value, max = MAX_ENTRIES) {
  return Array.isArray(value) && value.length <= max;
}

function validCapabilityList(items, max) {
  return list(items, max) &&
    items.every(id => CapabilityIdPolicy.validate(id).ok) &&
    new Set(items).size === items.length;
}

function providedItem(item, objectId) {
  if (!fields(item, PROVIDED) ||
      PROVIDED.size !== Object.keys(item).length ||
      !CapabilityIdPolicy.validate(item.service).ok ||
      typeof item.action !== "string" ||
      item.action.length > 64 || !ACTION.test(item.action)) {
    return false;
  }
  const descriptor = APIDescriptorPolicy.validate({
    apiVersion: 1, id: item.service, owner: objectId,
    action: item.action, version: item.version,
    visibility: "Public", sideEffect: "none",
    inputSchema: item.inputSchema, outputSchema: item.outputSchema
  });
  return descriptor.ok && CatalogVersionPolicy.inspect(
    descriptor.value).ok;
}

export const ProviderManifestPolicy = Object.freeze({
  manifestVersion: 1,
  maxBytes: MAX_BYTES,
  validate(candidate) {
    if (!record(candidate) || !dataTree(candidate)) {
      return fail("Invalid manifest data");
    }
    if (!fields(candidate, KEYS) ||
        Object.keys(candidate).length !== KEYS.size) {
      return fail("Invalid manifest fields");
    }
    const json = JSON.stringify(candidate);
    if (encoder.encode(json).byteLength > MAX_BYTES) {
      return fail("Manifest exceeds byte budget");
    }
    if (candidate.manifestVersion !== 1 ||
        !CapabilityIdPolicy.validate(candidate.providerId).ok ||
        typeof candidate.objectId !== "string" ||
        candidate.objectId.length > 128 ||
        !OBJECT_ID.test(candidate.objectId) ||
        BANNED.has(candidate.objectId)) {
      return fail("Invalid manifest identity");
    }
    if (!list(candidate.provides) || !candidate.provides.length ||
        !candidate.provides.every(item =>
          providedItem(item, candidate.objectId))) {
      return fail("Invalid provided service");
    }
    const services = candidate.provides.map(item => item.service);
    if (new Set(services).size !== services.length ||
        !validCapabilityList(candidate.requires, 64) ||
        !validCapabilityList(candidate.permissions, 64) ||
        candidate.requires.some(id => services.includes(id))) {
      return fail("Duplicate or cyclic service dependency");
    }
    if (!fields(candidate.execution, EXECUTION) ||
        Object.keys(candidate.execution).length !== 2 ||
        !ISOLATION.has(candidate.execution.isolation) ||
        !CONCURRENCY.has(candidate.execution.concurrency)) {
      return fail("Invalid execution declaration");
    }
    // All values are plain data; reparse to detach and freeze recursively.
    function freeze(value) {
      if (Array.isArray(value)) return Object.freeze(value.map(freeze));
      if (!value || typeof value !== "object") return value;
      const copy = Object.create(null);
      for (const [key, item] of Object.entries(value)) {
        copy[key] = freeze(item);
      }
      return Object.freeze(copy);
    }
    return Object.freeze({
      ok: true, status: 200, value: freeze(JSON.parse(json))
    });
  }
});
