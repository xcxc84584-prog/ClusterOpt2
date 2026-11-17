/**
 * PR04.04: bounded JSON-compatible runtime contract check.
 * This is intentionally smaller than JSON Schema. It supports only
 * fields already accepted by APIDescriptorPolicy.
 */
const MAX_DEPTH = 8;
const MAX_ENTRIES = 1024;
const MAX_BYTES = 1048576;
const BAD = new Set(["__proto__", "prototype", "constructor"]);
const encoder = new TextEncoder();

function plain(value) {
  if (!value || typeof value !== "object" ||
      Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function check(value, schema, depth, seen) {
  if (depth > MAX_DEPTH || !schema) return false;
  if (schema.type === "null") return value === null;
  if (schema.type === "string") return typeof value === "string";
  if (schema.type === "boolean") return typeof value === "boolean";
  if (schema.type === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (schema.type === "integer") return Number.isSafeInteger(value);
  if (schema.type === "array" && !Array.isArray(value)) return false;
  if (schema.type === "object" && !plain(value)) return false;
  if (schema.type !== "array" && schema.type !== "object") return false;
  if (seen.has(value)) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(value);
  if (keys.length > MAX_ENTRIES || Reflect.ownKeys(value).length !==
      keys.length + (Array.isArray(value) ? 1 : 0)) return false;
  if (Array.isArray(value) && keys.length !== value.length) return false;
  if (keys.some(key => BAD.has(key) ||
      !Object.hasOwn(descriptors[key], "value"))) return false;
  seen.add(value);
  let valid;
  if (Array.isArray(value)) {
    valid = keys.every(key =>
      check(descriptors[key].value, schema.items ?? null,
        depth + 1, seen));
  } else {
    const required = schema.required ?? [];
    valid = required.every(key => Object.hasOwn(descriptors, key)) &&
      keys.every(key => {
        const child = schema.properties?.[key];
        return child ? check(descriptors[key].value,
          child, depth + 1, seen) :
          schema.additionalProperties !== false &&
          safeData(descriptors[key].value, depth + 1, seen);
      });
  }
  seen.delete(value);
  return valid;
}

function safeData(value, depth, seen) {
  if (depth > MAX_DEPTH) return false;
  if (value === null || typeof value === "string" ||
      typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (seen.has(value) || (!plain(value) && !Array.isArray(value))) {
    return false;
  }
  // Recurse over arbitrary JSON-compatible additional properties.
  const keys = Object.keys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.length > MAX_ENTRIES ||
      Reflect.ownKeys(value).length !==
        keys.length + (Array.isArray(value) ? 1 : 0) ||
      (Array.isArray(value) && keys.length !== value.length) ||
      keys.some(key => BAD.has(key) ||
        !Object.hasOwn(descriptors[key], "value"))) return false;
  seen.add(value);
  const valid = keys.every(key =>
    safeData(descriptors[key].value, depth + 1, seen));
  seen.delete(value);
  return valid;
}

export const RouteContractPolicy = Object.freeze({
  maxBytes: MAX_BYTES,
  validate(value, schema) {
    try {
      if (!check(value, schema, 0, new Set())) return false;
      return encoder.encode(JSON.stringify(value)).byteLength <= MAX_BYTES;
    } catch {
      return false;
    }
  },
  compatible(left, right) {
    function canonical(value) {
      if (Array.isArray(value)) return value.map(canonical);
      if (!value || typeof value !== "object") return value;
      return Object.fromEntries(Object.keys(value).sort().map(key =>
        [key, canonical(value[key])]));
    }
    return JSON.stringify(canonical(left)) ===
      JSON.stringify(canonical(right));
  }
});
