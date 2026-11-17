import { describeObjectAPIs, validateObjectContract } from "./ObjectContract.js";
import { ProviderManifestPolicy } from "../property/ProviderManifestPolicy.js";

/**
 * Volatile runtime registry. No localStorage: registrations expire on reload.
 * Unknown object IDs can only be materialized from explicitly supplied factories.
 */
export class UnifiedRegistrationUnit {
  constructor(propertyRegistry = null) {
    this.propertyRegistry = propertyRegistry;
    this.objects = new Map();
    this.factories = new Map();
    this.providers = new Map();
  }

  register(object) {
    const validation = validateObjectContract(object,
      object?.strictOCDA === true);
    if (!validation.ok) {
      return { ok: false, status: 400,
        error: "Invalid object contract: " + validation.failures.join(", ") };
    }
    if (object.parentPath &&
        !object.id.startsWith(object.parentPath + ".")) {
      return { ok: false, status: 400,
        error: "SubObject requires the complete parent path" };
    }
    const previous = this.objects.get(object.id);
    if (previous && previous !== object) {
      return { ok: false, status: 409, error: "Duplicate object ID" };
    }
    this.objects.set(object.id, object);
    return { ok: true, status: 200, value: object };
  }

  /**
   * Internal metadata projection; never implicitly invoke an unknown
   * factory or grant an external caller a HubUnit permission.
   */
  describeAPI(id) {
    const object = this.objects.get(id);
    if (!object) return { ok: false, status: 404 };
    return describeObjectAPIs(object);
  }

  addFactory(id, factory) {
    if (!id || typeof factory !== "function") return false;
    this.factories.set(id, factory);
    return true;
  }

  resolve(id) {
    const existing = this.objects.get(id);
    if (existing) return { ok: true, status: 200, value: existing };
    const factory = this.factories.get(id);
    if (!factory) {
      return { ok: false, status: 404, error: "Unregistered object" };
    }
    try {
      return this.register(factory());
    } catch (error) {
      return { ok: false, status: 500, error: String(error) };
    }
  }

  /**
   * Provider metadata is owned by URU, never by a parallel Object
   * registry. Only already-registered Objects can bind a Manifest.
   * Authorization of the caller is enforced by HubUnit.
   */
  registerProvider(manifest) {
    const parsed = ProviderManifestPolicy.validate(manifest);
    if (!parsed.ok) return parsed;
    const value = parsed.value;
    const object = this.objects.get(value.objectId);
    if (!object) {
      return { ok: false, status: 404, error: "Object not registered" };
    }
    if (!value.provides.every(item =>
      object.ocda?.Request?.includes(item.action))) {
      return { ok: false, status: 400,
        error: "Provider action not declared by Object" };
    }
    if (this.providers.has(value.providerId)) {
      return { ok: false, status: 409, error: "Duplicate provider ID" };
    }
    this.providers.set(value.providerId, value);
    return { ok: true, status: 201, value };
  }

  unregisterProvider(providerId) {
    return this.providers.delete(providerId);
  }

  getProvider(providerId) {
    return this.providers.get(providerId) ?? null;
  }

  listProviders() {
    return Object.freeze([...this.providers.values()]);
  }

  registerProperty(name, value, options = {}) {
    if (!this.propertyRegistry) {
      return { ok: false, status: 503, error: "No property registry" };
    }
    return this.propertyRegistry.register(name, value, options);
  }

  unregisterProperty(name) {
    return this.propertyRegistry?.unregister(name) ?? false;
  }

  unregister(id) {
    const removed = this.objects.delete(id);
    if (removed) {
      for (const [providerId, manifest] of this.providers) {
        if (manifest.objectId === id) this.providers.delete(providerId);
      }
    }
    return removed;
  }

  subobjects(parentPath) {
    if (typeof parentPath !== "string" || !parentPath) return [];
    const prefix = parentPath + ".";
    return this.list().filter(id => id.startsWith(prefix));
  }

  list() {
    return [...this.objects.keys()];
  }
}
