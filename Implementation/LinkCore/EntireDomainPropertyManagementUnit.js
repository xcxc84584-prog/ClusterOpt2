/**
 * Domain property registry: one definition, multiple object subscribers.
 * A property value is updated once and read through the same registry.
 */
export class EntireDomainPropertyManagementUnit {
  constructor() {
    this.properties = new Map();
  }

  register(name, value, options = {}) {
    if (!name || typeof name !== "string" || this.properties.has(name)) {
      return { ok: false, status: 409, error: "Invalid/duplicate property" };
    }
    this.properties.set(name, {
      value,
      owners: new Set(options.owners ?? []),
      visibility: options.visibility ?? "Public"
    });
    return { ok: true, status: 201 };
  }

  describe(name) {
    const record = this.properties.get(name);
    return record ? {
      visibility: record.visibility,
      owners: [...record.owners]
    } : null;
  }

  get(name) {
    return this.properties.get(name)?.value;
  }

  update(name, value) {
    const property = this.properties.get(name);
    if (!property) return { ok: false, status: 404 };
    property.value = value;
    return { ok: true, status: 200 };
  }

  unregister(name) {
    return this.properties.delete(name);
  }

  list() {
    return [...this.properties].map(([name, record]) => ({
      name, visibility: record.visibility, owners: [...record.owners]
    }));
  }
}
