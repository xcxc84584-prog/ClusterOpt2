/**
 * PR03.06: only explicit in-process trusted factories may be used.
 * Validation is not a supply-chain attestation; PR06 adds isolation.
 */
export const ProviderFactoryPolicy = Object.freeze({
  inspect(manifest, factory) {
    if (!manifest || !Array.isArray(manifest.provides) ||
        typeof factory !== "function" ||
        factory.constructor?.name === "AsyncFunction") {
      return { ok: false, status: 400 };
    }
    return { ok: true, status: 200 };
  },
  inspectInstance(value) {
    if (!value || typeof value !== "object" ||
        typeof value.then === "function") {
      return { ok: false, status: 500 };
    }
    return { ok: true, status: 200 };
  }
});
