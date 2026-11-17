/**
 * PR06.05: bounded JSON-structured message envelope.
 * Do not transfer functions, FileSystemHandles, Proxies, Blobs,
 * cycles, accessors, prototypes, hidden keys or polluted names.
 */
const BLOCKED = new Set(["__proto__", "prototype", "constructor"]);
const MAX_BYTES = 65536;
const MAX_DEPTH = 8;
const MAX_ENTRIES = 128;
const encoder = new TextEncoder();

function plain(value) {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function safe(value, depth, active) {
  if (depth > MAX_DEPTH) return false;
  if (value === null || typeof value === "string" ||
      typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || active.has(value)) return false;
  if (!Array.isArray(value) && !plain(value)) return false;
  active.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(value);
  const own = Reflect.ownKeys(value);
  if (keys.length > MAX_ENTRIES ||
      keys.length !== (Array.isArray(value) ?
        value.length : own.length) ||
      (Array.isArray(value) && own.length !== keys.length + 1)) {
    return false;
  }
  const ok = keys.every(key =>
    !BLOCKED.has(key) &&
    Object.hasOwn(descriptors[key], "value") &&
    safe(descriptors[key].value, depth + 1, active));
  active.delete(value);
  return ok;
}

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value === null || typeof value !== "object") return value;
  const result = Object.create(null);
  for (const [key, item] of Object.entries(value)) result[key] = freeze(item);
  return Object.freeze(result);
}

export const PluginMessagePolicy = Object.freeze({
  maxBytes: MAX_BYTES,
  inspect(value) {
    try {
      if (!safe(value, 0, new Set())) {
        return { ok: false, status: 400,
          error: "Unsafe plugin message" };
      }
      const json = JSON.stringify(value);
      if (json === undefined ||
          encoder.encode(json).byteLength > MAX_BYTES) {
        return { ok: false, status: 413 };
      }
      return { ok: true, status: 200,
        value: freeze(JSON.parse(json)) };
    } catch {
      return { ok: false, status: 400,
        error: "Invalid plugin message" };
    }
  }
});
