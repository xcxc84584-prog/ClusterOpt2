/**
 * PR14.4: strict local-agent transport contract.
 * This is validation only; no authority, token or socket is stored here.
 */
const HEX = /^[a-f0-9]{64}$/i;
const SAFE = new Set(["ready", "pong", "error"]);
export const PluginLocalAgentPolicy = Object.freeze({
  address: "ws://127.0.0.1:43879/agent",
  maxMessageBytes: 65536,
  authTimeoutMs: 10000,
  pingTimeoutMs: 5000,
  validToken(value) {
    return typeof value === "string" && HEX.test(value);
  },
  inspectMessage(value) {
    if (typeof value !== "string" || value.length > 65536) {
      return { ok: false, status: 413 };
    }
    let message;
    try { message = JSON.parse(value); }
    catch { return { ok: false, status: 400 }; }
    if (!message || typeof message !== "object" ||
        Array.isArray(message) || !SAFE.has(message.type)) {
      return { ok: false, status: 403 };
    }
    if (message.type === "pong" &&
        (typeof message.requestId !== "string" ||
         !/^[a-f0-9-]{36}$/i.test(message.requestId))) {
      return { ok: false, status: 400 };
    }
    return { ok: true, status: 200, value: message };
  }
});
