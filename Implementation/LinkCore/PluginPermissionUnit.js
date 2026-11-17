import { PluginPermissionPolicy } from
  "../property/PluginPermissionPolicy.js";

/**
 * Runtime-only permission ledger. URU remains Provider authority.
 * This class cannot grant Core permissions or bypass HubUnit ACL.
 */
export class PluginPermissionUnit {
  constructor(registry, omu) {
    this.registry = registry;
    this.omu = omu;
    this.grants = new Map();
  }

  record(source, action, status, providerId) {
    this.omu.record(status < 400 ? "Log" : "EHU", source,
      "Plugin.Permission." + action, status, providerId);
  }

  grant(source, providerId, permission, approval = false) {
    const manifest = this.registry.getProvider(providerId);
    let status = 200;
    if (!manifest || !this.registry.objects.has(source)) status = 404;
    else if (manifest.objectId !== source) status = 403;
    else if (!manifest.permissions.includes(permission)) status = 403;
    else {
      const declared = PluginPermissionPolicy.inspect(
        manifest.permissions);
      const allowed = PluginPermissionPolicy.authorize(
        permission, approval);
      if (!declared.ok) status = declared.status;
      else if (!allowed.ok) status = allowed.status;
    }
    if (status === 200) {
      const active = this.grants.get(providerId) ?? new Set();
      active.add(permission);
      this.grants.set(providerId, active);
    }
    this.record(source, "Grant", status, providerId);
    return { ok: status === 200, status };
  }

  revoke(source, providerId, permission) {
    const manifest = this.registry.getProvider(providerId);
    const status = !manifest || !this.registry.objects.has(source) ?
      404 : manifest.objectId !== source ? 403 :
        !PluginPermissionPolicy.level(permission) ? 400 : 200;
    if (status === 200) {
      const current = this.grants.get(providerId);
      current?.delete(permission);
      if (!current?.size) this.grants.delete(providerId);
    }
    this.record(source, "Revoke", status, providerId);
    return { ok: status === 200, status };
  }

  allows(providerId, permission) {
    const manifest = this.registry.getProvider(providerId);
    return Boolean(manifest && manifest.permissions.includes(permission) &&
      this.registry.objects.has(manifest.objectId) &&
      !this.registry.disabledProviders.has(providerId) &&
      this.grants.get(providerId)?.has(permission));
  }

  forget(providerId) { this.grants.delete(providerId); }
}
