import { PropertyDescriptorPolicy } from
  "../property/PropertyDescriptorPolicy.js";

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
    const owners = [...(options.owners ?? [])];
    const visibility = options.visibility ?? "Public";
    let descriptor = null;
    if (options.descriptor !== undefined) {
      const checked = PropertyDescriptorPolicy.validate(options.descriptor);
      if (!checked.ok) return { ok: false, status: checked.status,
        error: "Invalid property descriptor", failures: checked.failures };
      descriptor = checked.value;
      if (descriptor.name !== name ||
          descriptor.visibility !== visibility ||
          descriptor.owners.length !== owners.length ||
          descriptor.owners.some(owner => !owners.includes(owner))) {
        return { ok: false, status: 400,
          error: "Property descriptor disagrees with EDPMU identity" };
      }
    }
    this.properties.set(name, {
      value, owners: new Set(owners), visibility, descriptor
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

  /** Trusted metadata projection; never a permission or mutation API. */
  describeProperty(name) {
    const record = this.properties.get(name);
    if (!record) return { ok: false, status: 404 };
    return { ok: true, status: 200, value: record.descriptor };
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

  inheritedBy(objectPath) {
    return [...this.properties].filter(([, property]) =>
      [...property.owners].some(owner => objectPath === owner ||
        objectPath.startsWith(owner + "."))
    ).map(([name]) => name);
  }

  list() {
    return [...this.properties].map(([name, record]) => ({
      name, visibility: record.visibility, owners: [...record.owners]
    }));
  }
}
