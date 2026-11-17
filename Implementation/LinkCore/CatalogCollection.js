/**
 * Trusted, read-only catalog projection over the existing URU and EDPMU.
 * No caching or duplicate registration state: every call reflects the
 * current registries. This class does not authorize API execution.
 */
const MAX_ENTRIES = 4096;

export class CatalogCollection {
  constructor(uru, edpmu) {
    this.uru = uru;
    this.edpmu = edpmu;
  }

  /** Internal snapshot; consumer-facing filtering belongs to PR02.05/06. */
  collect() {
    const objects = this.uru.list();
    const properties = this.edpmu.list();
    if (objects.length + properties.length > MAX_ENTRIES) {
      return { ok: false, status: 413, error: "Catalog entry limit" };
    }

    const apis = [];
    for (const owner of objects) {
      const object = this.uru.objects.get(owner);
      // Legacy Objects have no self-description contract. Keep them
      // runnable but do not infer or publish undocumented APIs.
      if (!object?.ocda?.APIDescriptors) continue;
      const response = this.uru.describeAPI(owner);
      if (!response.ok) {
        return { ok: false, status: response.status,
          error: "Catalog object lookup failed" };
      }
      for (const descriptor of response.value) {
        apis.push(Object.freeze({ owner, descriptor }));
      }
    }

    const describedProperties = [];
    for (const entry of properties) {
      const response = this.edpmu.describeProperty(entry.name);
      if (!response.ok) {
        return { ok: false, status: response.status,
          error: "Catalog property lookup failed" };
      }
      // Legacy properties without descriptors stay functional, but do
      // not fabricate an API description from their live values.
      if (response.value !== null) {
        describedProperties.push(Object.freeze({
          name: entry.name, descriptor: response.value
        }));
      }
    }

    apis.sort((a, b) => a.owner.localeCompare(b.owner) ||
      a.descriptor.id.localeCompare(b.descriptor.id));
    describedProperties.sort((a, b) => a.name.localeCompare(b.name));
    return Object.freeze({
      ok: true, status: 200,
      value: Object.freeze({
        apis: Object.freeze(apis),
        properties: Object.freeze(describedProperties)
      })
    });
  }
}
