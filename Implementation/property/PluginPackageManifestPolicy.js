import { ProviderManifestPolicy } from "./ProviderManifestPolicy.js";
import { PluginRPCScopePolicy } from "./PluginRPCScopePolicy.js";

/**
 * PR13.1: Parse untrusted package metadata without executing plugin code.
 * This is a contract gate, NOT a registration or permission authority.
 */
const MAX_BYTES = 65536;
const MAX_LABEL = 128;
const ENTRY = /^[A-Za-z0-9_./-]+\.m?js$/;
const UI_ENTRY = /^[A-Za-z0-9_./-]+\.html?$/;
const FIELDS = new Set([
  "packageVersion", "name", "entry", "uiEntry",
  "provider", "description", "rpcScopes"
]);
const encoder = new TextEncoder();

function reject(error) {
  return Object.freeze({ ok: false, status: 400, error });
}

function isRecord(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function safeEntry(entry, pattern = ENTRY) {
  if (typeof entry !== "string" ||
      entry.length > 256 ||
      !pattern.test(entry) ||
      entry.startsWith("/") ||
      entry.startsWith("./") ||
      entry.includes("//") ||
      entry.includes("\\") ||
      entry.includes(":")) return false;
  return entry.split("/").every(part =>
    part !== "." && part !== ".." && part.length > 0);
}

export const PluginPackageManifestPolicy = Object.freeze({
  packageVersion: 1,
  maxBytes: MAX_BYTES,

  /**
   * Only JSON text from the selected file is accepted. No dynamic import,
   * fetch, Worker construction or URU registration occurs here.
   */
  validate(text) {
    if (typeof text !== "string" ||
        encoder.encode(text).byteLength > MAX_BYTES) {
      return reject("Package manifest exceeds size limit or is not text");
    }
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      return reject("Invalid package JSON");
    }
    if (!isRecord(value) ||
        Object.keys(value).some(key => !FIELDS.has(key)) ||
        !["packageVersion", "name", "entry", "provider"].every(
          key => Object.hasOwn(value, key))) {
      return reject("Unknown or missing package manifest fields");
    }
    if (value.packageVersion !== 1 ||
        typeof value.name !== "string" ||
        value.name.length < 1 || value.name.length > MAX_LABEL ||
        !safeEntry(value.entry) ||
        (value.uiEntry !== undefined &&
         !safeEntry(value.uiEntry, UI_ENTRY)) ||
        (value.description !== undefined &&
         (typeof value.description !== "string" ||
          value.description.length > 512))) {
      return reject("Invalid package metadata");
    }
    const provider = ProviderManifestPolicy.validate(value.provider);
    if (!provider.ok) return provider;
    if (provider.value.execution.isolation !== "worker") {
      return reject("External plugins must declare worker isolation");
    }
    const scopes = PluginRPCScopePolicy.inspect(value.rpcScopes ?? []);
    if (!scopes.ok) return reject("Invalid reverse RPC scopes");
    const result = Object.create(null);
    result.packageVersion = 1;
    result.name = value.name;
    result.entry = value.entry;
    if (value.uiEntry !== undefined) result.uiEntry = value.uiEntry;
    result.provider = provider.value;
    result.rpcScopes = scopes.value;
    if (value.description !== undefined) {
      result.description = value.description;
    }
    return Object.freeze({
      ok: true, status: 200, value: Object.freeze(result)
    });
  }
});
