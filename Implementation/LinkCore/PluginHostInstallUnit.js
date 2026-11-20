import { PluginFolderPackageUnit } from "./PluginFolderPackageUnit.js";
import { PluginSandboxBridge } from "./PluginSandboxBridge.js";
import { PluginUIHostUnit } from "./PluginUIHostUnit.js";
import { PluginCapabilityReviewPolicy } from
  "../property/PluginCapabilityReviewPolicy.js";
import { PluginRPCScopePolicy } from
  "../property/PluginRPCScopePolicy.js";
import { PluginRPCRevocationStoreUnit } from
  "./PluginRPCRevocationStoreUnit.js";

/**
 * Host-owned activation transaction, NOT a second Provider registry.
 * Identity lives in URU; this Map holds disposable sandbox handles only.
 * No plugin code can invoke install/approve/rollback from the RPC port.
 */
export class PluginHostInstallUnit {
  constructor(core, doc, bridgeFactory = null,
    revocationStore = null) {
    this.core = core;
    this.doc = doc;
    this.reader = new PluginFolderPackageUnit(core.omu);
    this.uiHost = new PluginUIHostUnit(core, doc);
    this.bridgeFactory = bridgeFactory ??
      (() => new PluginSandboxBridge(doc, core.omu));
    this.handles = new Map();
    this.revocationStore = revocationStore ??
      new PluginRPCRevocationStoreUnit(core.omu);
    this.revocationPending = new Set();
    this.revocationStore.subscribe?.(providerId => {
      void this.syncDurableRpcDenials(providerId);
    });
  }

  /**
   * Cross-tab notifications contain no grant. Always verify the
   * committed denial state again before applying a live revocation.
   */
  async syncDurableRpcDenials(providerId) {
    const provider = this.core.uru.getProvider(providerId);
    const bridge = this.handles.get(providerId);
    if (!provider || !bridge || this.revocationPending.has(providerId)) {
      return { ok: false, status: 404 };
    }
    const stored = await this.revocationStore.list(providerId);
    if (!stored.ok) {
      this.core.setProviderEnabled(provider.objectId,
        providerId, false);
      bridge.suspendHostRequests?.();
      this.uiHost.setEnabled(providerId, false);
      this.record(503, "RPCDenialSyncFailed", providerId);
      return { ok: false, status: 503 };
    }
    let revoked = 0;
    for (const scope of stored.value) {
      const active = bridge.listHostRPCScopes?.() ?? [];
      if (!active.some(item => item.target === scope.target &&
          item.action === scope.action &&
          item.property === scope.property)) continue;
      const result = bridge.revokeHostRPCScope(scope);
      if (result.ok) revoked++;
    }
    if (revoked) this.record(200, "RPCDenialSyncApplied", providerId);
    return { ok: true, status: 200, revoked };
  }

  record(status, reason, providerId = "") {
    this.core.omu.record(status < 400 ? "Log" : "EHU",
      "PluginHostInstall", "Plugin.Install." + reason,
      status, providerId);
  }

  /**
   * UI-facing Host operation; no plugin-visible RPC exposes these calls.
   * The live Bridge is the only scope state owner after consent.
   */
  listRpcScopes(providerId) {
    if (!this.core.uru.getProvider(providerId) ||
        !this.handles.has(providerId)) return Object.freeze([]);
    return this.handles.get(providerId).listHostRPCScopes?.() ??
      Object.freeze([]);
  }

  getRPCCircuitState(providerId) {
    return this.handles.get(providerId)?.getHostRPCCircuitState?.() ??
      Object.freeze({ open: false, timeoutCount: 0 });
  }

  resetRPCCircuit(providerId, options = {}) {
    if (options.consented !== true) {
      return { ok: false, status: 403 };
    }
    const bridge = this.handles.get(providerId);
    if (!bridge || !this.core.uru.getProvider(providerId)) {
      return { ok: false, status: 404 };
    }
    const result = bridge.resetHostRPCCircuit?.(true) ??
      { ok: false, status: 503 };
    this.record(result.status, result.ok ?
      "RPCCircuitReset" : "RPCCircuitResetRejected", providerId);
    return result;
  }

  async listRevokedRpcScopes(providerId) {
    if (!this.core.uru.getProvider(providerId) ||
        !this.handles.has(providerId)) {
      return { ok: false, status: 404 };
    }
    return this.revocationStore.list(providerId);
  }

  revokeRpcScope(providerId, scope) {
    const provider = this.core.uru.getProvider(providerId);
    const bridge = this.handles.get(providerId);
    if (!provider || !bridge) return { ok: false, status: 404 };
    if (typeof bridge.revokeHostRPCScope !== "function") {
      return { ok: false, status: 503 };
    }
    const result = bridge.revokeHostRPCScope(scope);
    this.record(result.status, result.ok ?
      "RPCScopeRevoked" : "RPCScopeRevokeRejected", providerId);
    return result;
  }

  /**
   * Immediately revoke in memory, then durably record a deny tombstone.
   * Storage failure cannot report success; Provider is suspended to
   * avoid further requests during an uncertain persistence state.
   */
  async revokeRpcScopePersisted(providerId, scope) {
    if (this.revocationPending.has(providerId)) {
      return { ok: false, status: 409 };
    }
    this.revocationPending.add(providerId);
    try {
      const revoked = this.revokeRpcScope(providerId, scope);
      if (!revoked.ok) return revoked;
      const saved = await this.revocationStore.mark(providerId, scope);
      if (saved.ok) return { ok: true, status: 200 };
      const provider = this.core.uru.getProvider(providerId);
      if (provider) {
        this.core.setProviderEnabled(
          provider.objectId, providerId, false);
        this.handles.get(providerId)?.suspendHostRequests?.();
        this.uiHost.setEnabled(providerId, false);
      }
      this.record(503, "RPCRevokePersistenceFailed", providerId);
      return { ok: false, status: 503,
        error: "Revoked for this Session; persistence unavailable" };
    } finally {
      this.revocationPending.delete(providerId);
    }
  }

  /**
   * Explicit Host-only reapproval of an originally reviewed scope.
   * The Session is suspended while memory grants and IndexedDB
   * tombstones change, so no uncommitted scope can serve Worker RPC.
   */
  async reapproveRpcScope(providerId, scope, options = {}) {
    if (options.consented !== true) {
      return { ok: false, status: 403 };
    }
    const provider = this.core.uru.getProvider(providerId);
    const bridge = this.handles.get(providerId);
    if (!provider || !bridge) return { ok: false, status: 404 };
    if (this.revocationPending.has(providerId)) {
      return { ok: false, status: 409 };
    }
    this.revocationPending.add(providerId);
    const disabled = this.core.uru.disabledProviders.has(providerId);
    let suspended = false;
    const restoreSession = () => {
      if (!suspended) return { ok: true, status: 200 };
      const result = bridge.resumeHostRequests?.();
      if (result?.ok) return result;
      this.core.setProviderEnabled(provider.objectId, providerId, false);
      this.uiHost.setEnabled(providerId, false);
      this.record(503, "RPCReapprovalSessionFailed", providerId);
      return { ok: false, status: 503 };
    };
    try {
      const checked = PluginRPCScopePolicy.inspect([scope]);
      if (!checked.ok) return { ok: false, status: 400 };
      const wanted = checked.value[0];
      const stored = await this.revocationStore.list(providerId);
      if (!stored.ok) return { ok: false, status: 503 };
      const matches = item => item.target === wanted.target &&
        item.action === wanted.action &&
        item.property === wanted.property;
      if (!stored.value.some(matches)) {
        return { ok: false, status: 404 };
      }
      if (!disabled) {
        if (!bridge.suspendHostRequests?.()) {
          return { ok: false, status: 503 };
        }
        suspended = true;
      }
      const granted = bridge.grantReviewedHostRPCScope?.(wanted) ??
        { ok: false, status: 503 };
      if (!granted.ok) {
        const recovered = restoreSession();
        return recovered.ok ? granted : recovered;
      }
      // The Worker cannot use the new grant until a fresh handshake.
      const cleared = await this.revocationStore.clear(
        providerId, wanted);
      if (!cleared.ok) {
        bridge.revokeHostRPCScope(wanted);
        const recovered = restoreSession();
        this.record(503, "RPCReapprovalPersistenceFailed",
          providerId);
        return recovered.ok ? { ok: false, status: 503 } : recovered;
      }
      const resumed = restoreSession();
      if (!resumed.ok) {
        bridge.revokeHostRPCScope(wanted);
        await this.revocationStore.mark(providerId, wanted);
        return resumed;
      }
      this.record(200, "RPCReapproved", providerId);
      return { ok: true, status: 200 };
    } finally {
      this.revocationPending.delete(providerId);
    }
  }

  async install(snapshot, options = {}) {
    const checked = this.reader.inspectImport(snapshot);
    if (!checked.ok) return checked;
    const manifest = JSON.parse(snapshot.manifestText);
    const provider = manifest.provider;
    const review = PluginCapabilityReviewPolicy.inspect(provider,
      options.approvedPermissions ?? []);
    if (!review.ok) {
      this.record(review.status, "PermissionRejected",
        provider.providerId);
      return review;
    }
    const scopeReview = PluginRPCScopePolicy.review(
      manifest.rpcScopes ?? [], options.approvedRpcScopes ?? []);
    if (!scopeReview.ok) {
      this.record(scopeReview.status, "RPCScopeRejected",
        provider.providerId);
      return scopeReview;
    }
    // A remembered deny is never an approval. On a fresh install,
    // even an approved manifest cannot silently recover revoked routes.
    let effectiveRpcScopes = scopeReview.value;
    if (scopeReview.value.length) {
      const stored = await this.revocationStore.list(provider.providerId);
      if (!stored.ok) {
        this.record(503, "RPCDenialLoadFailed", provider.providerId);
        return { ok: false, status: 503 };
      }
      const denied = new Set(stored.value.map(item =>
        JSON.stringify([item.target, item.action,
          item.property ?? null])));
      effectiveRpcScopes = Object.freeze(scopeReview.value.filter(item =>
        !denied.has(JSON.stringify([
          item.target, item.action, item.property ?? null
        ]))));
      if (effectiveRpcScopes.length !== scopeReview.value.length) {
        this.record(403, "RPCPersistedDenyApplied",
          provider.providerId);
      }
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
    const entry = manifest.entry;
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
    // Unexpected Worker failure is isolated from all other Providers.
    // Only the currently installed Bridge can disable its owner.
    bridge.onFault = (status, reason) => {
      if (this.handles.get(provider.providerId) !== bridge) return;
      const live = this.core.uru.getProvider(provider.providerId);
      if (!live) return;
      this.core.setProviderEnabled(
        live.objectId, provider.providerId, false);
      this.uiHost.setEnabled(provider.providerId, false);
      this.record(status, "WorkerFault." + reason,
        provider.providerId);
    };
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
      const mounted = this.uiHost.mount(snapshot, provider);
      if (!mounted.ok) throw Error("Plugin UI mount failed");
      // Session activation happens only after URU registration,
      // permission approval and UI mount have succeeded.
      if (typeof bridge.enableHostRequests === "function") {
        const linked = bridge.enableHostRequests(
          this.core, effectiveRpcScopes);
        if (!linked.ok) throw Error("Plugin RPC session failed");
      }
      this.handles.set(provider.providerId, bridge);
      this.record(201, "Activated", provider.providerId);
      return { ok: true, status: 201, providerId: provider.providerId };
    } catch {
      if (registered) this.core.unregister(provider.objectId);
      this.uiHost.unmount(provider.providerId);
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
    if (this.revocationPending.has(providerId)) {
      return { ok: false, status: 409 };
    }
    if (this.core.uru.disabledProviders.has(providerId)) {
      return { ok: true, status: 200 };
    }
    const blocked = this.blocked(providerId);
    if (blocked) return blocked;
    const result = this.core.setProviderEnabled(
      provider.objectId, providerId, false);
    if (result.ok) {
      bridge.suspendHostRequests?.();
      this.uiHost.setEnabled(providerId, false);
    }
    return result;
  }

  enable(providerId) {
    const bridge = this.handles.get(providerId);
    const provider = this.core.uru.getProvider(providerId);
    if (!bridge || !provider || bridge.closed) {
      return { ok: false, status: 404 };
    }
    if (this.revocationPending.has(providerId)) {
      return { ok: false, status: 409 };
    }
    for (const service of provider.requires) {
      if (!this.core.services.resolve(service).ok) {
        this.record(409, "Dependency", providerId);
        return { ok: false, status: 409,
          error: "Missing service dependency" };
      }
    }
    const result = this.core.setProviderEnabled(
      provider.objectId, providerId, true);
    if (result.ok) {
      const resumed = bridge.resumeHostRequests?.();
      if (resumed && !resumed.ok) {
        this.core.setProviderEnabled(provider.objectId, providerId, false);
        this.record(503, "SessionResumeFailed", providerId);
        return { ok: false, status: 503 };
      }
      this.uiHost.setEnabled(providerId, true);
    }
    return result;
  }

  uninstall(providerId) {
    const bridge = this.handles.get(providerId);
    const provider = this.core.uru.getProvider(providerId);
    if (!bridge || !provider) return { ok: false, status: 404 };
    if (this.revocationPending.has(providerId)) {
      return { ok: false, status: 409 };
    }
    const blocked = this.blocked(providerId);
    if (blocked) return blocked;
    const result = this.core.unregisterProvider(
      provider.objectId, providerId);
    if (!result.ok) return result;
    this.core.unregister(provider.objectId);
    this.uiHost.unmount(providerId);
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
    const scopeReview = PluginRPCScopePolicy.review(
      JSON.parse(snapshot.manifestText).rpcScopes ?? [],
      options.approvedRpcScopes ?? []);
    if (!scopeReview.ok) return scopeReview;
    // Re-registering the Provider creates a brief service gap.
    // Block the upgrade if active dependents lack alternatives.
    if (this.dependents(providerId).length) {
      return this.blocked(providerId);
    }
    if (this.revocationPending.has(providerId) ||
        this.core.hub.providerInflight.get(providerId) > 0 ||
        (previousBridge.pendingHostRequestCount?.() ?? 0) > 0) {
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
    const previousUI = this.uiHost.views.get(providerId);
    const disabled = this.core.setProviderEnabled(
      previous.objectId, providerId, false);
    if (!disabled.ok) return disabled;
    previousBridge.suspendHostRequests?.();
    const removed = this.core.unregisterProvider(
      previous.objectId, providerId);
    if (!removed.ok) {
      if (!wasDisabled) {
        this.core.setProviderEnabled(previous.objectId, providerId, true);
        previousBridge.resumeHostRequests?.();
      }
      return removed;
    }
    this.core.unregister(previous.objectId);
    this.handles.delete(providerId);
    this.uiHost.unmount(providerId);
    const installed = await this.install(snapshot, options);
    if (installed.ok) {
      if (wasDisabled) {
        this.core.setProviderEnabled(previous.objectId, providerId, false);
        this.handles.get(providerId)?.suspendHostRequests?.();
        this.uiHost.setEnabled(providerId, false);
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
      if (!wasDisabled) {
        const resumed = previousBridge.resumeHostRequests?.();
        if (resumed && !resumed.ok) {
          this.core.setProviderEnabled(previous.objectId, providerId, false);
          this.record(503, "RestoreSessionFailed", providerId);
          return { ok: false, status: 503,
            error: "Provider restored but RPC Session unavailable" };
        }
      }
      if (previousUI) {
        this.uiHost.mount(previousUI.snapshot, previousUI.provider);
        this.uiHost.setEnabled(providerId, !wasDisabled);
      }
      this.record(409, "UpgradeRolledBack", providerId);
      return { ok: false, status: installed.status,
        error: "Upgrade failed; previous Provider restored" };
    }
    this.uiHost.unmount(providerId);
    previousBridge.terminate(500, "RestoreFailed");
    this.record(500, "RestoreFailed", providerId);
    return { ok: false, status: 500,
      error: "Upgrade failed and restoration failed" };
  }
}
