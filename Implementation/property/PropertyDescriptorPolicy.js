/** Immutable, bounded OCDA Property metadata. Descriptions grant no rights. */
const NAME = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;
const TYPES = new Set([
  "string", "number", "integer", "boolean", "object", "array",
  "function", "null", "unknown"
]);
const VISIBILITY = new Set(["Public", "Protected", "Private"]);
const FIELDS = new Set([
  "apiVersion", "name", "type", "owners", "visibility",
  "readable", "writable", "invariants", "description"
]);
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);
const MAX_BYTES = 8192;

function isRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function names(values, max = 32) {
  return Array.isArray(values) && values.length > 0 &&
    values.length <= max && new Set(values).size === values.length &&
    values.every(item => typeof item === "string" &&
      item.length <= 128 && NAME.test(item) && !FORBIDDEN.has(item));
}

export const PropertyDescriptorPolicy = Object.freeze({
  apiVersion: 1,
  maxBytes: MAX_BYTES,
  validate(candidate) {
    const failures = [];
    if (!isRecord(candidate) ||
        Object.keys(candidate).some(key => !FIELDS.has(key) ||
          FORBIDDEN.has(key))) {
      return { ok: false, status: 400, failures: ["invalid-structure"] };
    }
    // Check descriptors before accessing any supplied property values.
    if (Object.keys(candidate).some(key => {
      const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
      return !Object.hasOwn(descriptor, "value");
    })) return { ok: false, status: 400, failures: ["accessor"] };
    if (candidate.apiVersion !== 1) failures.push("apiVersion");
    if (typeof candidate.name !== "string" ||
        candidate.name.length > 128 || !NAME.test(candidate.name) ||
        FORBIDDEN.has(candidate.name)) failures.push("name");
    if (!TYPES.has(candidate.type)) failures.push("type");
    if (!names(candidate.owners)) failures.push("owners");
    if (!VISIBILITY.has(candidate.visibility)) failures.push("visibility");
    if (typeof candidate.readable !== "boolean") failures.push("readable");
    if (typeof candidate.writable !== "boolean") failures.push("writable");
    if (candidate.invariants !== undefined &&
        (!Array.isArray(candidate.invariants) ||
         candidate.invariants.length > 32 ||
         candidate.invariants.some(item => typeof item !== "string" ||
           item.length > 256) ||
         new Set(candidate.invariants).size !==
           candidate.invariants.length)) failures.push("invariants");
    if (candidate.description !== undefined &&
        (typeof candidate.description !== "string" ||
         candidate.description.length > 1024)) failures.push("description");
    if (failures.length) return { ok: false, status: 400, failures };
    const canonical = {
      apiVersion: 1, name: candidate.name, type: candidate.type,
      owners: [...candidate.owners], visibility: candidate.visibility,
      readable: candidate.readable, writable: candidate.writable,
      invariants: [...(candidate.invariants ?? [])]
    };
    if (candidate.description !== undefined) {
      canonical.description = candidate.description;
    }
    if (new TextEncoder().encode(JSON.stringify(canonical)).byteLength >
        MAX_BYTES) return { ok: false, status: 413,
      failures: ["descriptor-too-large"] };
    Object.freeze(canonical.owners);
    Object.freeze(canonical.invariants);
    return { ok: true, status: 200, value: Object.freeze(canonical) };
  }
});
