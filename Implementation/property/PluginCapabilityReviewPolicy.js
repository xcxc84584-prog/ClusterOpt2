import { PluginPermissionPolicy } from "./PluginPermissionPolicy.js";

/**
 * PR13.4: fail-closed host review of requested capabilities.
 * A manifest never grants itself permissions.
 */
function fail(status, error) {
  return Object.freeze({ ok: false, status, error });
}

export const PluginCapabilityReviewPolicy = Object.freeze({
  inspect(manifest, approved = []) {
    const declared = PluginPermissionPolicy.inspect(
      manifest?.permissions);
    if (!declared.ok) return declared;
    if (!Array.isArray(approved) ||
        approved.length !== new Set(approved).size ||
        !approved.every(value =>
          typeof value === "string" && declared.value.includes(value))) {
      return fail(400, "Invalid approval selection");
    }
    for (const permission of declared.value) {
      if (PluginPermissionPolicy.level(permission) === "core") {
        return fail(403, "Core capability cannot be granted");
      }
      if (!approved.includes(permission)) {
        return fail(403, "Capability requires explicit approval");
      }
      const allowed = PluginPermissionPolicy.authorize(permission, true);
      if (!allowed.ok) return allowed;
    }
    return Object.freeze({
      ok: true, status: 200,
      value: Object.freeze([...approved])
    });
  }
});
