import { CatalogVisibilityPolicy } from
  "../property/CatalogVisibilityPolicy.js";

/**
 * Source-scoped, ephemeral projection, never an independent catalog.
 * Delegates to the live URU/EDPMU; excludes invisible descriptors before
 * CatalogQuery computes counts, term matches or page offsets.
 */
export class AuthorizedCatalogCollection {
  constructor(collection, registry, properties, source, origin = "user") {
    this.collection = collection;
    this.registry = registry;
    this.properties = properties;
    this.source = source;
    this.origin = origin;
  }

  collect() {
    const snapshot = this.collection.collect();
    if (!snapshot.ok) return snapshot;
    const apis = snapshot.value.apis.filter(item =>
      CatalogVisibilityPolicy.canSeeAPI(this.source, item,
        this.registry.objects.get(item.owner), this.origin));
    const properties = snapshot.value.properties.filter(item =>
      CatalogVisibilityPolicy.canSeeProperty(this.source, item,
        this.properties.describe(item.name)));
    return Object.freeze({
      ok: true, status: 200,
      value: Object.freeze({
        apis: Object.freeze(apis),
        properties: Object.freeze(properties)
      })
    });
  }
}
