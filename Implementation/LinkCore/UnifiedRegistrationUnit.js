/**
 * Volatile runtime registry. No localStorage: registrations expire on reload.
 * Unknown object IDs can only be materialized from explicitly supplied factories.
 */
export class UnifiedRegistrationUnit {
  constructor() {
    this.objects = new Map();
    this.factories = new Map();
  }

  register(object) {
    if (!object || !object.id || typeof object.id !== "string" ||
        typeof object.receive !== "function") {
      return { ok: false, status: 400, error: "Invalid object" };
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

  unregister(id) {
    return this.objects.delete(id);
  }

  list() {
    return [...this.objects.keys()];
  }
}
