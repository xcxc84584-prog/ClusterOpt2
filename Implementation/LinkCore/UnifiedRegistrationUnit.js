import { validateObjectContract } from "./ObjectContract.js";

/**
 * Volatile runtime registry. No localStorage: registrations expire on reload.
 * Unknown object IDs can only be materialized from explicitly supplied factories.
 */
export class UnifiedRegistrationUnit {
  constructor(propertyRegistry = null) {
    this.propertyRegistry = propertyRegistry;
    this.objects = new Map();
    this.factories = new Map();
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
    return this.objects.delete(id);
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
