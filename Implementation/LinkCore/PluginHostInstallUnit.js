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
    const parsed = checked.value;
    const entry = parsed.manifest.entry;
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

  disable(providerId) {
    const bridge = this.handles.get(providerId);
    const provider = this.core.uru.getProvider(providerId);
    if (!bridge || !provider) return { ok: false, status: 404 };
    return this.core.setProviderEnabled(
      provider.objectId, providerId, false);
  }

  uninstall(providerId) {
    const bridge = this.handles.get(providerId);
    const provider = this.core.uru.getProvider(providerId);
    if (!bridge || !provider) return { ok: false, status: 404 };
    const result = this.core.unregisterProvider(
      provider.objectId, providerId);
    if (!result.ok) return result;
    this.core.unregister(provider.objectId);
    bridge.terminate(200, "Uninstalled");
    this.handles.delete(providerId);
    this.record(200, "Uninstalled", providerId);
    return { ok: true, status: 200 };
  }
}
