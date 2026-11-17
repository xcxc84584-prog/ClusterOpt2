import { CapabilityIdPolicy } from "../property/CapabilityIdPolicy.js";
import { ProviderCompatibilityPolicy } from
  "../property/ProviderCompatibilityPolicy.js";

/**
 * PR03.05: read-only, live projection of URU's authoritative index.
 * This class NEVER registers Objects, chooses active routes or executes
 * Provider code. Multiple Providers may offer a single Service.
 */
export class ServiceRegistry {
  constructor(uru) {
    this.uru = uru;
  }

  list() {
    return Object.freeze(this.uru.listServices());
  }

  resolve(serviceId) {
    if (!CapabilityIdPolicy.validate(serviceId).ok) {
      return { ok: false, status: 400 };
    }
    const providers = this.uru.providersForService(serviceId);
    return providers.length ?
      { ok: true, status: 200, value: providers } :
      { ok: false, status: 404 };
  }

  candidates(serviceId) {
    return this.resolve(serviceId);
  }

  negotiate(requirement) {
    const result = this.resolve(requirement?.service);
    if (!result.ok) return result;
    const available = result.value.filter(manifest =>
      manifest.provides.some(item =>
        ProviderCompatibilityPolicy.inspect(item, requirement).ok));
    return available.length ?
      { ok: true, status: 200, value: Object.freeze(available) } :
      { ok: false, status: 409, error: "No compatible Provider" };
  }
}
