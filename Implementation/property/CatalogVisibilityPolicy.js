import { AccessPolicy } from "./AccessPolicy.js";

/**
 * Trusted catalog projection. Authorization must happen BEFORE search,
 * counts and pagination, never on an already paginated result.
 * Metadata is not an invocation capability.
 */
export const CatalogVisibilityPolicy = Object.freeze({
  canSeeAPI(source, entry, object, origin = "user") {
    if (!object || !["user", "agent"].includes(origin)) return false;
    const exposed = origin === "agent" ? "AgentAPI" : "UserAPI";
    return Array.isArray(object.ocda?.[exposed]) &&
      object.ocda[exposed].includes(entry.descriptor.action) &&
      AccessPolicy.canUseAction(source, entry.owner,
        entry.descriptor.action, object);
  },

  canSeeProperty(source, entry, definition) {
    if (!definition || entry.descriptor.readable !== true) return false;
    if (definition.visibility !== entry.descriptor.visibility) return false;
    return definition.visibility === "Public" ||
      definition.owners.some(owner =>
        AccessPolicy.canInvoke(source, owner, definition.visibility));
  }
});
