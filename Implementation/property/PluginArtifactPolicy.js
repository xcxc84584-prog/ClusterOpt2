/**
 * PR06.07: verify bytes against a trusted, pre-pinned SHA-256 digest.
 * This is an integrity check, not signer authentication or execution
 * authorization. Never execute verified bytes merely because they match.
 */
const MAX_BYTES = 1024 * 1024;
const DIGEST = /^[a-f0-9]{64}$/;

export const PluginArtifactPolicy = Object.freeze({
  maxBytes: MAX_BYTES,

  async verify(bytes, expectedSha256) {
    if (!(bytes instanceof Uint8Array) ||
        bytes.byteLength === 0 ||
        bytes.byteLength > MAX_BYTES ||
        typeof expectedSha256 !== "string" ||
        !DIGEST.test(expectedSha256)) {
      return { ok: false, status: 400 };
    }
    if (!globalThis.crypto?.subtle) {
      return { ok: false, status: 503 };
    }
    try {
      // Copy before asynchronous hashing: caller cannot change the data
      // that was accepted during the integrity check.
      const detached = new Uint8Array(bytes);
      const digest = await crypto.subtle.digest("SHA-256", detached);
      const hex = Array.from(new Uint8Array(digest),
        item => item.toString(16).padStart(2, "0")).join("");
      if (hex !== expectedSha256) {
        return { ok: false, status: 412 };
      }
      return { ok: true, status: 200, value: Object.freeze({
        sha256: hex, byteLength: detached.byteLength
      }) };
    } catch {
      return { ok: false, status: 400 };
    }
  }
});
