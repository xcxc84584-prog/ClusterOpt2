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

  /**
   * Route selection is scoped to registered caller identity and the
   * explicit origin. No origin is inferred from a caller-provided route.
   * A configured Provider must still be live in URU on every request.
   */
  resolve(service, action, source = null, origin = null,
    routes = null) {
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
    const configured = routes?.filter(route =>
      route.service === service && route.action === action &&
      route.sourceFilter.origins.includes(origin) &&
      (!route.sourceFilter.objects.length ||
        route.sourceFilter.objects.includes(source))) ?? [];
    if (configured.length) {
      const sorted = [...configured].sort((a, b) =>
        b.priority - a.priority);
      if (sorted.length > 1 &&
          sorted[0].priority === sorted[1].priority) {
        return { ok: false, status: 409,
          error: "Ambiguous replace route priority" };
      }
      const selected = sorted[0].providers[0];
      const provider = matches.find(item =>
        item.providerId === selected);
      if (!provider) {
        return { ok: false, status: 404,
          error: "Configured Provider unavailable" };
      }
      if (!this.registry.objects.has(provider.objectId)) {
        return { ok: false, status: 404,
          error: "Provider Object unavailable" };
      }
      return { ok: true, status: 200,
        value: Object.freeze({
          service, action, providerId: selected,
          objectId: provider.objectId
        }) };
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
