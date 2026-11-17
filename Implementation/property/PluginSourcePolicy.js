/**
 * PR06.04 security boundary: the built-in Worker is trusted application
 * code. A same-origin Worker is NOT an untrusted-code sandbox.
 *
 * No arbitrary source URLs, code strings, dynamic imports or Blob URLs.
 */
export const PluginSourcePolicy = Object.freeze({
  inspect(candidate) {
    if (!candidate || typeof candidate !== "object" ||
        Array.isArray(candidate)) return { ok: false, status: 400 };
    try {
      const proto = Object.getPrototypeOf(candidate);
      const descriptors = Object.getOwnPropertyDescriptors(candidate);
      if ((proto !== Object.prototype && proto !== null) ||
          Reflect.ownKeys(candidate).length !== 1 ||
          !Object.hasOwn(descriptors, "kind") ||
          !Object.hasOwn(descriptors.kind, "value")) {
        return { ok: false, status: 400 };
      }
      if (descriptors.kind.value !== "builtin") {
        return { ok: false, status: 403,
          error: "External plugin execution unavailable" };
      }
      return { ok: true, status: 200,
        value: Object.freeze({ kind: "builtin" }) };
    } catch {
      return { ok: false, status: 400 };
    }
  }
});
