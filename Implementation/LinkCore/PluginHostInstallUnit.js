import { PluginFolderPackageUnit } from "./PluginFolderPackageUnit.js";
import { PluginSandboxBridge } from "./PluginSandboxBridge.js";
import { PluginCapabilityReviewPolicy } from
  "../property/PluginCapabilityReviewPolicy.js";

/**
 * Host-owned activation transaction, NOT a second Provider registry.
 * Identity lives in URU; this Map holds disposable sandbox handles only.
 * No plugin code can invoke install/approve/rollback from the RPC port.
 */
export class PluginHostInstallUnit {
  constructor(core, doc, bridgeFactory = null) {
    this.core = core;
    this.doc = doc;
    this.reader = new PluginFolderPackageUnit(core.omu);
    this.bridgeFactory = bridgeFactory ??
      (() => new PluginSandboxBridge(doc, core.omu));
    this.handles = new Map();
  }

  record(status, reason, providerId = "") {
    this.core.omu.record(status < 400 ? "Log" : "EHU",
      "PluginHostInstall", "Plugin.Install." + reason,
      status, providerId);
  }

  async install(snapshot, options = {}) {
    const checked = this.reader.inspectImport(snapshot);
    if (!checked.ok) return checked;
    const provider = JSON.parse(snapshot.manifestText).provider;
    const review = PluginCapabilityReviewPolicy.inspect(provider,
      options.approvedPermissions ?? []);
    if (!review.ok) {
      this.record(review.status, "PermissionRejected",
        provider.providerId);
      return review;
    }
    if (options.consented !== true) {
      this.record(403, "ConsentRequired", provider.providerId);
      return { ok: false, status: 403, error: "Consent required" };
    }
    if (this.handles.has(provider.providerId) ||
        this.core.uru.getProvider(provider.providerId) ||
        this.core.uru.objects.has(provider.objectId)) {
      this.record(409, "Duplicate", provider.providerId);
      return { ok: false, status: 409 };
    }
    for (const dependency of provider.requires) {
      if (!this.core.services.resolve(dependency).ok) {
        this.record(409, "Dependency", provider.providerId);
        return { ok: false, status: 409,
          error: "Missing service dependency" };
      }
    }
    const entry = JSON.parse(snapshot.manifestText).entry;
    let source;
    try {
      const binary = atob(snapshot.files[entry]);
      const bytes = Uint8Array.from(binary, character =>
        character.charCodeAt(0));
      source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      this.record(400, "EntryInvalid", provider.providerId);
      return { ok: false, status: 400 };
    }
    const bridge = this.bridgeFactory();
    const boot = await bridge.start(provider, source);
    if (!boot.ok) {
      bridge.terminate(boot.status, "BootstrapRejected");
      this.record(boot.status, "BootstrapRejected", provider.providerId);
      return boot;
    }
    const object = {
      id: provider.objectId,
      strictOCDA: true,
      authorization: { default: "Public" },
      ocda: {
        EHU: [], Log: [],
        Request: provider.provides.map(item => item.action),
        Response: [],
        UserAPI: provider.provides.map(item => item.action),
        AgentAPI: [],
        Property: [],
        Program: "UntrustedSandbox"
      },
      receive: async (action, payload, context = {}) => {
        const result = await this.core.hub.invokeExternalPlugin(
          context.source, provider.providerId, action, payload, bridge);
        if (!result.ok) {
          const failure = new Error("Sandbox request rejected");
          failure.status = result.status;
          throw failure;
        }
        return result.value;
      }
    };
    let registered = false;
    try {
      if (!this.core.register(object)) throw Error("Object registration");
      registered = true;
      const added = this.core.registerProvider(provider.objectId, provider);
      if (!added.ok) throw Error("Provider registration");
      for (const permission of provider.permissions) {
        const grant = this.core.grantPluginPermission(
          provider.objectId, provider.providerId, permission, true);
        if (!grant.ok) throw Error("Capability grant");
      }
      this.handles.set(provider.providerId, bridge);
      this.record(201, "Activated", provider.providerId);
      return { ok: true, status: 201, providerId: provider.providerId };
    } catch {
      if (registered) this.core.unregister(provider.objectId);
      bridge.terminate(500, "Rollback");
      this.record(409, "Rollback", provider.providerId);
      return { ok: false, status: 409,
        error: "Activation rolled back" };
    }
  }

  /**
   * Resolve dependents from URU's live Provider declarations, never a
   * duplicate dependency registry. An alternate enabled Provider keeps
   * the service available when this Provider is removed.
   */
  dependents(providerId) {
    const target = this.core.uru.getProvider(providerId);
    if (!target) return [];
    const services = new Set(target.provides.map(item => item.service));
    return this.core.uru.listProviders().filter(candidate => {
      if (candidate.providerId === providerId ||
          this.core.uru.disabledProviders.has(candidate.providerId)) {
        return false;
      }
      return candidate.requires.some(service => {
        if (!services.has(service) ||
            !this.core.uru.isServiceEnabled(providerId, service)) {
          return false;
        }
        const alternatives = this.core.services.resolve(service);
        return !alternatives.ok || !alternatives.value.some(item =>
          item.providerId !== providerId);
      });
    }).map(item => item.providerId);
  }

  blocked(providerId) {
    const dependents = this.dependents(providerId);
    if (!dependents.length) return null;
    this.record(409, "DependentProviders", providerId);
    return { ok: false, status: 409,
      error: "Active Provider dependencies", dependents };
  }

  disable(providerId) {
    const bridge = this.handles.get(providerId);
    const provider = this.core.uru.getProvider(providerId);
    if (!bridge || !provider) return { ok: false, status: 404 };
    if (this.core.uru.disabledProviders.has(providerId)) {
      return { ok: true, status: 200 };
    }
    const blocked = this.blocked(providerId);
    if (blocked) return blocked;
    return this.core.setProviderEnabled(
      provider.objectId, providerId, false);
  }

  enable(providerId) {
    const bridge = this.handles.get(providerId);
    const provider = this.core.uru.getProvider(providerId);
    if (!bridge || !provider || bridge.closed) {
      return { ok: false, status: 404 };
    }
    for (const service of provider.requires) {
      if (!this.core.services.resolve(service).ok) {
        this.record(409, "Dependency", providerId);
        return { ok: false, status: 409,
          error: "Missing service dependency" };
      }
    }
    return this.core.setProviderEnabled(
      provider.objectId, providerId, true);
  }

  uninstall(providerId) {
    const bridge = this.handles.get(providerId);
    const provider = this.core.uru.getProvider(providerId);
    if (!bridge || !provider) return { ok: false, status: 404 };
    const blocked = this.blocked(providerId);
    if (blocked) return blocked;
    const result = this.core.unregisterProvider(
      provider.objectId, providerId);
    if (!result.ok) return result;
    this.core.unregister(provider.objectId);
    bridge.terminate(200, "Uninstalled");
    this.handles.delete(providerId);
    this.record(200, "Uninstalled", providerId);
    return { ok: true, status: 200 };
  }

  /**
   * Upgrade holds the existing sandbox until replacement activation.
   * On failure the original URU Object, Provider and previously active
   * grants are restored; newly requested capabilities never survive.
   * Explicit consent is required on EACH upgrade.
   */
  async upgrade(providerId, snapshot, options = {}) {
    const previous = this.core.uru.getProvider(providerId);
    const previousBridge = this.handles.get(providerId);
    if (!previous || !previousBridge) {
      return { ok: false, status: 404 };
    }
    if (options.consented !== true) {
      this.record(403, "UpgradeConsentRequired", providerId);
      return { ok: false, status: 403 };
    }
    const checked = this.reader.inspectImport(snapshot);
    if (!checked.ok) return checked;
    const next = JSON.parse(snapshot.manifestText).provider;
    if (next.providerId !== providerId ||
        next.objectId !== previous.objectId) {
      this.record(409, "UpgradeIdentity", providerId);
      return { ok: false, status: 409 };
    }
    const review = PluginCapabilityReviewPolicy.inspect(next,
      options.approvedPermissions ?? []);
    if (!review.ok) return review;
    // Re-registering the Provider creates a brief service gap.
    // Block the upgrade if active dependents lack alternatives.
    if (this.dependents(providerId).length) {
      return this.blocked(providerId);
    }
    if (this.core.hub.providerInflight.get(providerId) > 0) {
      this.record(409, "UpgradeBusy", providerId);
      return { ok: false, status: 409 };
    }
    for (const service of next.requires) {
      const found = this.core.services.resolve(service);
      if (!found.ok || !found.value.some(item =>
        item.providerId !== providerId)) {
        this.record(409, "UpgradeDependency", providerId);
        return { ok: false, status: 409 };
      }
    }

    // Preserve only grants that were still active before replacement.
    const previousGrants = previous.permissions.filter(permission =>
      this.core.checkPluginPermission(providerId, permission));
    const wasDisabled =
      this.core.uru.disabledProviders.has(providerId);
    const priorObject = this.core.uru.objects.get(previous.objectId);
    const disabled = this.core.setProviderEnabled(
      previous.objectId, providerId, false);
    if (!disabled.ok) return disabled;
    const removed = this.core.unregisterProvider(
      previous.objectId, providerId);
    if (!removed.ok) {
      if (!wasDisabled) this.core.setProviderEnabled(
        previous.objectId, providerId, true);
      return removed;
    }
    this.core.unregister(previous.objectId);
    this.handles.delete(providerId);
    const installed = await this.install(snapshot, options);
    if (installed.ok) {
      if (wasDisabled) {
        this.core.setProviderEnabled(previous.objectId, providerId, false);
      }
      previousBridge.terminate(200, "Upgraded");
      this.record(200, "Upgraded", providerId);
      return installed;
    }

    // install() rolls back any partially registered new Object.
    const objectRestored = this.core.register(priorObject);
    const providerRestored = objectRestored ?
      this.core.registerProvider(previous.objectId, previous) :
      { ok: false };
    if (providerRestored.ok) {
      for (const permission of previousGrants) {
        this.core.grantPluginPermission(
          previous.objectId, providerId, permission, true);
      }
      if (wasDisabled) this.core.setProviderEnabled(
        previous.objectId, providerId, false);
      this.handles.set(providerId, previousBridge);
      this.record(409, "UpgradeRolledBack", providerId);
      return { ok: false, status: installed.status,
        error: "Upgrade failed; previous Provider restored" };
    }
    previousBridge.terminate(500, "RestoreFailed");
    this.record(500, "RestoreFailed", providerId);
    return { ok: false, status: 500,
      error: "Upgrade failed and restoration failed" };
  }
}
