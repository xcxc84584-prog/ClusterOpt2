/**
 * AI AGENT MCP(ChatGPT) — PR14.2 contract-only worker.
 *
 * This code runs inside the existing opaque-origin plugin sandbox.
 * No host object, browser DOM, local socket, credential or filesystem
 * capability is available to this module.
 */
const CAPABILITIES = Object.freeze([
  "status.read",
  "contract.describe"
]);

/** Public read-only status. Never imply an authenticated session. */
export function getStatus() {
  return {
    phase: "contract-only",
    connected: false,
    privileged: false
  };
}

/** Describe only services implemented by this package today. */
export function describe() {
  return {
    contractVersion: 1,
    pluginName: "AI AGENT MCP(ChatGPT)",
    capabilities: [...CAPABILITIES]
  };
}
