import { CapabilityIdPolicy } from "./CapabilityIdPolicy.js";
import { CatalogVersionPolicy } from "./CatalogVersionPolicy.js";

/**
 * PR03.08: fail-closed metadata negotiation only.
 * Schema equality is deliberately conservative until PR04 routing and
 * more expressive variance/compatibility proofs are implemented.
 */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = canonical(value[key]);
  }
  return output;
}

export const ProviderCompatibilityPolicy = Object.freeze({
  inspect(provided, requirement) {
    if (!provided || !requirement ||
        !CapabilityIdPolicy.validate(requirement.service).ok ||
        typeof requirement.version !== "string" ||
        !requirement.inputSchema || !requirement.outputSchema) {
      return { ok: false, status: 400 };
    }
    if (provided.service !== requirement.service) {
      return { ok: false, status: 409,
        error: "Capability mismatch" };
    }
    const version = CatalogVersionPolicy.inspect(
      { version: provided.version }, requirement.version);
    if (!version.ok) return version;
    if (!version.value.compatible) {
      return { ok: false, status: 409,
        error: "Provider version mismatch" };
    }
    const sameSchema = JSON.stringify(canonical(provided.inputSchema)) ===
      JSON.stringify(canonical(requirement.inputSchema)) &&
      JSON.stringify(canonical(provided.outputSchema)) ===
      JSON.stringify(canonical(requirement.outputSchema));
    return sameSchema ? { ok: true, status: 200,
      value: Object.freeze({ compatible: true }) } :
      { ok: false, status: 409,
        error: "Provider contract mismatch" };
  }
});
