import { describeObjectAPIs, validateObjectContract } from "./ObjectContract.js";
import { ProviderManifestPolicy } from "../property/ProviderManifestPolicy.js";
import { ProviderFactoryPolicy } from "../property/ProviderFactoryPolicy.js";

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
    this.providerServices = new Map();
    this.providerFactories = new Map();
    this.providerInstances = new Map();
    this.disabledProviders = new Set();
    this.disabledServices = new Map();
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
    for (const item of value.provides) {
      const list = this.providerServices.get(item.service) ?? new Set();
      list.add(value.providerId);
      this.providerServices.set(item.service, list);
    }
    return { ok: true, status: 201, value };
  }

  attachProviderFactory(providerId, factory) {
    const manifest = this.providers.get(providerId);
    if (!manifest) return { ok: false, status: 404 };
    const check = ProviderFactoryPolicy.inspect(manifest, factory);
    if (!check.ok) return check;
    if (this.providerFactories.has(providerId)) {
      return { ok: false, status: 409 };
    }
    this.providerFactories.set(providerId, factory);
    return { ok: true, status: 201 };
  }

  materializeProvider(providerId) {
    if (!this.providers.has(providerId)) {
      return { ok: false, status: 404 };
    }
    if (this.disabledProviders.has(providerId)) {
      return { ok: false, status: 409, error: "Provider disabled" };
    }
    if (this.providerInstances.has(providerId)) {
      return { ok: true, status: 200,
        value: this.providerInstances.get(providerId) };
    }
    const factory = this.providerFactories.get(providerId);
    if (!factory) return { ok: false, status: 404 };
    try {
      const instance = factory();
      const checked = ProviderFactoryPolicy.inspectInstance(instance);
      if (!checked.ok) return checked;
      this.providerInstances.set(providerId, instance);
      return { ok: true, status: 201, value: instance };
    } catch (_error) {
      return { ok: false, status: 500,
        error: "Trusted Provider factory failed" };
    }
  }

  disposeProvider(providerId) {
    const instance = this.providerInstances.get(providerId);
    this.providerInstances.delete(providerId);
    if (!instance) return { ok: true, status: 200 };
    try {
      instance.dispose?.();
      return { ok: true, status: 200 };
    } catch (_error) {
      return { ok: false, status: 500,
        error: "Provider dispose failed" };
    }
  }

  unregisterProvider(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) return false;
    this.disposeProvider(providerId);
    this.providerFactories.delete(providerId);
    this.disabledProviders.delete(providerId);
    this.disabledServices.delete(providerId);
    for (const item of provider.provides) {
      const list = this.providerServices.get(item.service);
      list?.delete(providerId);
      if (!list?.size) this.providerServices.delete(item.service);
    }
    return this.providers.delete(providerId);
  }

  providersForService(serviceId) {
    const ids = this.providerServices.get(serviceId) ?? new Set();
    return Object.freeze([...ids].filter(id =>
      this.isServiceEnabled(id, serviceId)).map(id =>
      this.providers.get(id)).filter(Boolean));
  }

  listServices() {
    return Object.freeze([...this.providerServices.keys()].sort());
  }

  /**
   * PR03.07 provider and per-service availability is separate from
   * registration. No route table exists until PR04.
   */
  setProviderEnabled(providerId, enabled) {
    if (!this.providers.has(providerId)) {
      return { ok: false, status: 404 };
    }
    if (enabled) this.disabledProviders.delete(providerId);
    else {
      this.disabledProviders.add(providerId);
      this.disposeProvider(providerId);
    }
    return { ok: true, status: 200 };
  }

  setServiceEnabled(providerId, serviceId, enabled) {
    const manifest = this.providers.get(providerId);
    if (!manifest) return { ok: false, status: 404 };
    if (!manifest.provides.some(item => item.service === serviceId)) {
      return { ok: false, status: 404 };
    }
    const disabled = this.disabledServices.get(providerId) ?? new Set();
    if (enabled) disabled.delete(serviceId);
    else disabled.add(serviceId);
    if (disabled.size) this.disabledServices.set(providerId, disabled);
    else this.disabledServices.delete(providerId);
    return { ok: true, status: 200 };
  }

  isServiceEnabled(providerId, serviceId) {
    return !this.disabledProviders.has(providerId) &&
      !this.disabledServices.get(providerId)?.has(serviceId);
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
        if (manifest.objectId === id) this.unregisterProvider(providerId);
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
