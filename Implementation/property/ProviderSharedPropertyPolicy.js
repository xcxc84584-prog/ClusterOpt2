import { AccessPolicy } from "./AccessPolicy.js";

/**
 * PR03.04: EDPMU definitions are authoritative.
 * Manifest claims describe requested access, not a permission grant.
 */
export const ProviderSharedPropertyPolicy = Object.freeze({
  inspect(manifest, properties) {
    if (!manifest || !properties?.describe ||
        !Array.isArray(manifest.sharedProperties ?? [])) {
      return { ok: false, status: 400 };
    }
    for (const claim of manifest.sharedProperties ?? []) {
      const definition = properties.describe(claim.name);
      if (!definition) {
        return { ok: false, status: 404,
          error: "Property not registered" };
      }
      const owner = definition.owners.includes(manifest.objectId);
      if (claim.access === "write" &&
          (!owner || claim.isolation !== "shared")) {
        return { ok: false, status: 403,
          error: "Cannot claim shared Property write" };
      }
      if (claim.access === "read" &&
          definition.visibility !== "Public" && !owner &&
          !definition.owners.some(target =>
            AccessPolicy.canInvoke(manifest.objectId, target,
              definition.visibility))) {
        return { ok: false, status: 403,
          error: "Cannot claim non-public Property" };
      }
    }
    return { ok: true, status: 200 };
  },

  canWrite(manifest, name, properties) {
    const claim = manifest?.sharedProperties?.find(item =>
      item.name === name);
    if (!claim || claim.access !== "write") {
      return { ok: false, status: 403,
        error: "Provider has no write declaration" };
    }
    return this.inspect({
      objectId: manifest.objectId, sharedProperties: [claim]
    }, properties);
  }
});
