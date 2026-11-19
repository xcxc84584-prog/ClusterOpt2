/**
 * OCDA API Descriptor v1: immutable metadata, not an authorization grant.
 * HubUnit still enforces all Request/Response permissions at runtime.
 */
const NAME = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const VISIBILITY = new Set(["Public", "Protected", "Private"]);
const EFFECT = new Set(["none", "read", "write", "external"]);
const SCHEMA_TYPE = new Set([
  "object", "array", "string", "number", "integer", "boolean", "null"
]);
const FIELDS = new Set([
  "apiVersion", "id", "owner", "action", "version", "visibility",
  "sideEffect", "inputSchema", "outputSchema", "description",
  "since", "deprecated", "permissions", "errors", "examples"
]);
const SCHEMA_FIELDS = new Set([
  "type", "properties", "required", "items", "additionalProperties"
]);
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);
const MAX_BYTES = 16384;
const MAX_DEPTH = 8;
const MAX_KEYS = 128;

function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function schemaValid(schema, depth = 0) {
  if (!record(schema) || depth > MAX_DEPTH) return false;
  const keys = Object.keys(schema);
  if (keys.length > MAX_KEYS ||
      keys.some(key => !SCHEMA_FIELDS.has(key))) return false;
  if (!SCHEMA_TYPE.has(schema.type)) return false;
  if (schema.additionalProperties !== undefined &&
      typeof schema.additionalProperties !== "boolean") return false;
  if (schema.properties !== undefined) {
    if (schema.type !== "object" || !record(schema.properties)) {
      return false;
    }
    const names = Object.keys(schema.properties);
    if (names.length > MAX_KEYS || names.some(name =>
      FORBIDDEN.has(name) || !NAME.test(name))) return false;
    if (names.some(name => !schemaValid(
      schema.properties[name], depth + 1))) return false;
  }
  if (schema.required !== undefined) {
    if (schema.type !== "object" || !Array.isArray(schema.required)) {
      return false;
    }
    if (schema.required.length > MAX_KEYS ||
        new Set(schema.required).size !== schema.required.length ||
        schema.required.some(name => typeof name !== "string" ||
          !Object.hasOwn(schema.properties ?? {}, name))) return false;
  }
  if (schema.items !== undefined &&
      (schema.type !== "array" || !schemaValid(
        schema.items, depth + 1))) return false;
  return true;
}

function plainTree(value, depth = 0, seen = new Set()) {
  if (depth > MAX_DEPTH + 2) return false;
  if (value === null || typeof value === "boolean" ||
      typeof value === "string") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (!Array.isArray(value) && !record(value)) return false;
  if (seen.has(value)) return false;
  const keys = Object.keys(value);
  const own = Reflect.ownKeys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.length > MAX_KEYS ||
      (Array.isArray(value) ?
        (keys.length !== value.length || own.length !== keys.length + 1) :
        own.length !== keys.length)) {
    return false;
  }
  seen.add(value);
  const valid = keys.every(key =>
    !FORBIDDEN.has(key) &&
    Object.hasOwn(descriptors[key], "value") &&
    plainTree(descriptors[key].value, depth + 1, seen));
  seen.delete(value);
  return valid;
}

function frozenCopy(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(frozenCopy));
  if (!record(value)) return value;
  const copy = Object.create(null);
  for (const [key, item] of Object.entries(value)) {
    copy[key] = frozenCopy(item);
  }
  return Object.freeze(copy);
}

export const APIDescriptorPolicy = Object.freeze({
  apiVersion: 1,
  maxBytes: MAX_BYTES,
  validate(candidate) {
    const failures = [];
    if (!plainTree(candidate) || !record(candidate)) {
      return { ok: false, status: 400, failures: ["invalid-structure"] };
    }
    const serialized = JSON.stringify(candidate);
    if (!serialized ||
        new TextEncoder().encode(serialized).byteLength > MAX_BYTES) {
      failures.push("descriptor-too-large");
    }
    if (Object.keys(candidate).some(key => !FIELDS.has(key))) {
      failures.push("unknown-field");
    }
    if (candidate.apiVersion !== 1) failures.push("apiVersion");
    for (const field of ["id", "owner", "action"]) {
      if (typeof candidate[field] !== "string" ||
          !NAME.test(candidate[field]) || candidate[field].length > 128) {
        failures.push(field);
      }
    }
    if (typeof candidate.version !== "string" ||
        !VERSION.test(candidate.version)) failures.push("version");
    if (!VISIBILITY.has(candidate.visibility)) failures.push("visibility");
    if (!EFFECT.has(candidate.sideEffect)) failures.push("sideEffect");
    if (!schemaValid(candidate.inputSchema)) failures.push("inputSchema");
    if (!schemaValid(candidate.outputSchema)) failures.push("outputSchema");
    if (candidate.description !== undefined &&
        (typeof candidate.description !== "string" ||
         candidate.description.length > 1024)) failures.push("description");
    if (candidate.since !== undefined &&
        (typeof candidate.since !== "string" ||
         !VERSION.test(candidate.since))) failures.push("since");
    if (candidate.deprecated !== undefined &&
        typeof candidate.deprecated !== "boolean") {
      failures.push("deprecated");
    }
    if (candidate.permissions !== undefined &&
        (!Array.isArray(candidate.permissions) ||
         candidate.permissions.length > 64 ||
         new Set(candidate.permissions).size !== candidate.permissions.length ||
         candidate.permissions.some(value =>
           typeof value !== "string" || !NAME.test(value)))) {
      failures.push("permissions");
    }
    // Typed, bounded documentation metadata. Descriptions never grant
    // privileges or become executable callbacks.
    if (candidate.errors !== undefined &&
        (!Array.isArray(candidate.errors) ||
         candidate.errors.length > 16 ||
         candidate.errors.some(item =>
           !record(item) ||
           Object.keys(item).some(key =>
             !["status", "code", "message"].includes(key)) ||
           !Number.isInteger(item.status) ||
           item.status < 400 || item.status > 599 ||
           typeof item.code !== "string" || !NAME.test(item.code) ||
           typeof item.message !== "string" ||
           item.message.length > 256))) {
      failures.push("errors");
    }
    if (candidate.examples !== undefined &&
        (!Array.isArray(candidate.examples) ||
         candidate.examples.length > 8 ||
         candidate.examples.some(item =>
           !record(item) ||
           Object.keys(item).some(key =>
             !["title", "request", "response"].includes(key)) ||
           typeof item.title !== "string" ||
           item.title.length > 128 ||
           !record(item.request) || !plainTree(item.request) ||
           !record(item.response) || !plainTree(item.response)))) {
      failures.push("examples");
    }
    if (failures.length) return { ok: false, status: 400, failures };
    return { ok: true, status: 200, value: frozenCopy(candidate) };
  }
});
