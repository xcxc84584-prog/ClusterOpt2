/**
 * PR03.01: canonical capability / service identifiers.
 * Identity is separate from SemVer, providers, authorization and routes.
 * No mutable registry or plugin execution is introduced here.
 */
const SEGMENT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MAX_LENGTH = 128;
const MAX_SEGMENTS = 8;
const MAX_ENTRIES = 4096;
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);

function failure(status, reason) {
  return Object.freeze({ ok: false, status, error: reason });
}

function validId(id) {
  if (typeof id !== "string" || id.length > MAX_LENGTH ||
      id.length < 3 || id.includes("@")) return false;
  const segments = id.split(".");
  return segments.length >= 2 && segments.length <= MAX_SEGMENTS &&
    segments.every(item => SEGMENT.test(item) &&
      item.length <= 32 && !FORBIDDEN.has(item));
}

/**
 * Strict canonical spelling prevents ambiguity across locales/cases.
 * A Service name is not an authority, and cannot grant permissions.
 */
export const CapabilityIdPolicy = Object.freeze({
  maxLength: MAX_LENGTH,
  maxSegments: MAX_SEGMENTS,
  validate(id) {
    return validId(id) ?
      Object.freeze({ ok: true, status: 200, value: id }) :
      failure(400, "Invalid capability ID");
  },
  /**
   * Collision check for a future authoritative ServiceRegistry.
   * Does not reserve, claim or register anything.
   */
  checkUnique(id, existing = []) {
    if (!validId(id)) return failure(400, "Invalid capability ID");
    if (!Array.isArray(existing) || existing.length > MAX_ENTRIES ||
        existing.some(item => !validId(item))) {
      return failure(400, "Invalid capability collection");
    }
    if (existing.includes(id)) return failure(409, "Duplicate capability ID");
    return Object.freeze({ ok: true, status: 200, value: id });
  }
});
