import { CapabilityIdPolicy } from "../property/CapabilityIdPolicy.js";

/**
 * PR04.01: read-only logical Service/action resolver.
 * URU remains authoritative through the existing ServiceRegistry.
 * Fail with 409 instead of silently picking among multiple Providers.
 */
const ACTION = /^[a-z][a-zA-Z0-9]*$/;

export class ServiceRequestResolver {
  constructor(services, registry) {
    this.services = services;
    this.registry = registry;
  }

  resolve(service, action) {
    if (!CapabilityIdPolicy.validate(service).ok ||
        typeof action !== "string" || action.length > 64 ||
        !ACTION.test(action)) {
      return { ok: false, status: 400,
        error: "Invalid Service/action selector" };
    }
    const available = this.services.resolve(service);
    if (!available.ok) {
      return { ok: false, status: available.status,
        error: "Service unavailable" };
    }
    const matches = available.value.filter(manifest =>
      manifest.provides.some(item =>
        item.service === service && item.action === action));
    if (!matches.length) {
      return { ok: false, status: 404,
        error: "Service action unavailable" };
    }
    if (matches.length > 1) {
      return { ok: false, status: 409,
        error: "Ambiguous Service: route selection not configured" };
    }
    const provider = matches[0];
    if (!this.registry.objects.has(provider.objectId)) {
      return { ok: false, status: 404,
        error: "Provider Object unavailable" };
    }
    return {
      ok: true, status: 200,
      value: Object.freeze({
        service, action, providerId: provider.providerId,
        objectId: provider.objectId
      })
    };
  }
}
