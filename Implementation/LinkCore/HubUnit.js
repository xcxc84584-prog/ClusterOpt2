import { ParallelExecutionPolicy } from "../property/ParallelExecutionPolicy.js";
import { AccessPolicy } from "../property/AccessPolicy.js";
import { ProviderSharedPropertyPolicy } from
  "../property/ProviderSharedPropertyPolicy.js";
import { ProviderManifestPolicy } from
  "../property/ProviderManifestPolicy.js";
import { ExecutionScheduler } from "./ExecutionScheduler.js";
import { CatalogQuery } from "./CatalogQuery.js";
import { AuthorizedCatalogCollection } from
  "./AuthorizedCatalogCollection.js";

/**
 * Hub-only request/response crossing, registration and event observation.
 * A missing target may be registered only from a trusted predeclared factory.
 */
export class HubUnit {
  constructor(registry, properties, omu,
    scheduler = new ExecutionScheduler(), catalog = null) {
    this.registry = registry;
    this.properties = properties;
    this.omu = omu;
    this.scheduler = scheduler;
    this.waitEdges = new Map();
    this.catalog = catalog;
  }

  register(object) {
    const result = this.registry.register(object);
    this.omu.record(result.ok ? "Log" : "EHU",
      object?.id ?? "unknown", "Register", result.ok ? 201 : result.status);
    return result.ok;
  }

  unregister(id) {
    const removed = this.registry.unregister(id);
    this.omu.record(removed ? "Log" : "EHU", id, "Unregister",
      removed ? 200 : 404);
    return removed;
  }

  /**
   * Trusted in-process provider declaration. An Object may declare
   * only its own existing actions; no external Cluster.api mutation.
   */
  registerProvider(source, manifest) {
    if (typeof source !== "string" ||
        !this.registry.objects.has(source)) {
      this.omu.record("EHU", source ?? "unknown",
        "Provider.Register", 404);
      return { ok: false, status: 404, error: "Unknown caller" };
    }
    if (source !== manifest?.objectId) {
      this.omu.record("EHU", source, "Provider.Register", 403);
      return { ok: false, status: 403, error: "Provider owner mismatch" };
    }
    const parsed = ProviderManifestPolicy.validate(manifest);
    const claims = parsed.ok ?
      ProviderSharedPropertyPolicy.inspect(parsed.value, this.properties) :
      parsed;
    const result = claims.ok ?
      this.registry.registerProvider(parsed.value) : claims;
    this.omu.record(result.ok ? "Log" : "EHU", source,
      "Provider.Register", result.status, manifest?.providerId ?? "");
    return result;
  }

  unregisterProvider(source, providerId) {
    if (!this.registry.objects.has(source)) {
      this.omu.record("EHU", source, "Provider.Unregister", 404);
      return { ok: false, status: 404 };
    }
    const provider = this.registry.getProvider(providerId);
    if (!provider) {
      this.omu.record("EHU", source, "Provider.Unregister", 404);
      return { ok: false, status: 404 };
    }
    if (provider.objectId !== source) {
      this.omu.record("EHU", source, "Provider.Unregister", 403);
      return { ok: false, status: 403 };
    }
    this.registry.unregisterProvider(providerId);
    this.omu.record("Log", source, "Provider.Unregister", 200, providerId);
    return { ok: true, status: 200 };
  }

  /**
   * Explicit trusted Provider Property write: object ownership AND
   * Provider declaration AND EDPMU policy must all agree.
   */
  publishProviderProperty(source, providerId, name, value) {
    const provider = this.registry.getProvider(providerId);
    if (!provider || !this.registry.objects.has(source)) {
      this.omu.record("EHU", source, "Provider.Property.Write",
        404, name);
      return { ok: false, status: 404 };
    }
    if (provider.objectId !== source) {
      this.omu.record("EHU", source, "Provider.Property.Write",
        403, name);
      return { ok: false, status: 403 };
    }
    const allowed = ProviderSharedPropertyPolicy.canWrite(
      provider, name, this.properties);
    const result = allowed.ok ?
      this.properties.update(name, value) : allowed;
    this.omu.record(result.ok ? "Log" : "EHU", source,
      "Provider.Property.Write", result.status, name);
    return result;
  }

  attachProviderFactory(source, providerId, factory) {
    const manifest = this.registry.getProvider(providerId);
    const result = !this.registry.objects.has(source) || !manifest ?
      { ok: false, status: 404 } :
      manifest.objectId !== source ?
        { ok: false, status: 403 } :
        this.registry.attachProviderFactory(providerId, factory);
    this.omu.record(result.ok ? "Log" : "EHU", source,
      "Provider.Factory.Attach", result.status, providerId);
    return result;
  }

  materializeProvider(source, providerId) {
    const manifest = this.registry.getProvider(providerId);
    const result = !this.registry.objects.has(source) || !manifest ?
      { ok: false, status: 404 } :
      manifest.objectId !== source ?
        { ok: false, status: 403 } :
        this.registry.materializeProvider(providerId);
    this.omu.record(result.ok ? "Log" : "EHU", source,
      "Provider.Factory.Materialize", result.status, providerId);
    return result;
  }

  setProviderEnabled(source, providerId, enabled) {
    const provider = this.registry.getProvider(providerId);
    const result = !provider || !this.registry.objects.has(source) ?
      { ok: false, status: 404 } :
      provider.objectId !== source || typeof enabled !== "boolean" ?
        { ok: false, status: 403 } :
        this.registry.setProviderEnabled(providerId, enabled);
    this.omu.record(result.ok ? "Log" : "EHU", source,
      enabled ? "Provider.Enable" : "Provider.Disable",
      result.status, providerId);
    return result;
  }

  setServiceEnabled(source, providerId, serviceId, enabled) {
    const provider = this.registry.getProvider(providerId);
    const result = !provider || !this.registry.objects.has(source) ?
      { ok: false, status: 404 } :
      provider.objectId !== source || typeof enabled !== "boolean" ?
        { ok: false, status: 403 } :
        this.registry.setServiceEnabled(providerId, serviceId, enabled);
    this.omu.record(result.ok ? "Log" : "EHU", source,
      enabled ? "Provider.Service.Enable" : "Provider.Service.Disable",
      result.status, serviceId);
    return result;
  }

  disposeProvider(source, providerId) {
    const provider = this.registry.getProvider(providerId);
    const result = !provider || !this.registry.objects.has(source) ?
      { ok: false, status: 404 } :
      provider.objectId !== source ?
        { ok: false, status: 403 } :
        this.registry.disposeProvider(providerId);
    this.omu.record(result.ok ? "Log" : "EHU", source,
      "Provider.Dispose", result.status, providerId);
    return result;
  }

  reportProviderHealth(source, providerId, outcome, now) {
    const provider = this.registry.getProvider(providerId);
    if (!provider || !this.registry.objects.has(source)) {
      this.omu.record("EHU", source, "Provider.Health", 404,
        providerId);
      return { ok: false, status: 404 };
    }
    if (provider.objectId !== source) {
      this.omu.record("EHU", source, "Provider.Health", 403,
        providerId);
      return { ok: false, status: 403 };
    }
    const result = this.registry.updateProviderHealth(
      providerId, outcome, now);
    const status = result.ok && outcome === "timeout" ? 504 :
      result.ok && outcome === "failure" ? 503 : result.status;
    this.omu.record(status >= 400 ? "EHU" : "Log",
      source, "Provider.Health", status, providerId,
      { outcome: typeof outcome === "string" ? outcome : "invalid" });
    return result;
  }

  // Active wait-for edges are used only for deadlock detection.
  hasWaitPath(start, destination, visited = new Set()) {
    if (start === destination) return true;
    if (visited.has(start)) return false;
    visited.add(start);
    for (const next of this.waitEdges.get(start)?.keys() ?? []) {
      if (this.hasWaitPath(next, destination, visited)) return true;
    }
    return false;
  }

  addWaitEdge(source, target) {
    const edges = this.waitEdges.get(source) ?? new Map();
    edges.set(target, (edges.get(target) ?? 0) + 1);
    this.waitEdges.set(source, edges);
  }

  removeWaitEdge(source, target) {
    const edges = this.waitEdges.get(source);
    if (!edges) return;
    const remaining = (edges.get(target) ?? 1) - 1;
    if (remaining > 0) edges.set(target, remaining);
    else edges.delete(target);
    if (!edges.size) this.waitEdges.delete(source);
  }

  async request(source, target, action, payload = {}, options = {}) {
    if (!this.registry.objects.has(source)) {
      this.omu.record("Log", source, "Registration.Lookup", 404, source);
    }
    const sender = this.registry.resolve(source);
    if (!sender.ok) {
      this.omu.record("EHU", source, action, sender.status, target, {
        error: "Sender not registered"
      });
      return { ok: false, status: sender.status, error: sender.error };
    }
    if (!this.registry.objects.has(target)) {
      this.omu.record("Log", source, "Registration.Lookup", 404, target);
    }
    const receiver = this.registry.resolve(target);
    if (!receiver.ok) {
      this.omu.record("EHU", source, action, receiver.status, target, {
        error: receiver.error
      });
      return { ok: false, status: receiver.status, error: receiver.error };
    }
    if (options.origin === "user" || options.origin === "agent") {
      const apiName = options.origin === "user" ? "UserAPI" : "AgentAPI";
      if (!receiver.value.ocda?.[apiName]?.includes(action)) {
        this.omu.record("EHU", source, "Request." + action, 403, target, {
          error: "Not exposed by " + apiName
        });
        return { ok: false, status: 403,
          error: "Action not allowed by " + apiName };
      }
    }
    if (!AccessPolicy.canUseAction(source, target, action, receiver.value)) {
      this.omu.record("EHU", source, "Request." + action, 403,
        target, { error: "Access denied" });
      return { ok: false, status: 403, error: "Access denied" };
    }
    // Nested requests need a separate bounded dispatch slot to avoid
    // exhausting all normal slots while waiting for child operations.
    const nested = this.scheduler.activeKeys.has(source);
    if (nested && this.hasWaitPath(target, source)) {
      this.omu.record("EHU", source, "Request." + action, 423, target, {
        error: "Circular wait detected"
      });
      return { ok: false, status: 423, error: "Circular wait detected" };
    }
    if (nested && this.waitEdges.size >= this.scheduler.maxNested) {
      this.omu.record("EHU", source, "Request." + action, 429, target, {
        error: "Nested request depth limit reached"
      });
      return { ok: false, status: 429, error: "Nested limit reached" };
    }
    if (nested) this.addWaitEdge(source, target);
    try {
      return await this.scheduler.schedule(ParallelExecutionPolicy.resourceKey(target), async () => {
        this.omu.dependency(source, target, "request");
        this.omu.record("Log", source, "Request." + action, 200, target);
        try {
          const value = await receiver.value.receive(action, payload);
          this.omu.dependency(target, source, "response");
          this.omu.record("Log", target, "Response." + action, 200, source);
          return { ok: true, status: 200, value };
        } catch (error) {
          const status = Number.isInteger(error?.status) ?
            error.status : 500;
          this.omu.record("EHU", target, "Response." + action, status,
            source, { error: String(error) });
          return { ok: false, status, error: String(error) };
        }
      }, { signal: options.signal, nested });
    } catch (error) {
      const status = error.name === "AbortError" ? 499 : 429;
      this.omu.record("EHU", source, "Schedule." + action, status,
        target, { error: String(error) });
      return { ok: false, status, error: String(error) };
    } finally {
      if (nested) this.removeWaitEdge(source, target);
    }
  }

  /**
   * Trusted LinkCore-only discovery entry point. This is metadata
   * filtering, NOT a token or substitute for HubUnit.request checks.
   * No source factories are materialized implicitly.
   */
  discoverCatalog(source, command, kind, selector = {}, options = {}) {
    if (typeof source !== "string" ||
        !this.registry.objects.has(source)) {
      this.omu.record("EHU", source ?? "unknown", "Catalog.Discover",
        404, kind);
      return { ok: false, status: 404, error: "Unknown caller" };
    }
    if (!this.catalog || !["user", "agent"].includes(
      options?.origin ?? "user")) {
      this.omu.record("EHU", source, "Catalog.Discover", 400, kind);
      return { ok: false, status: 400, error: "Invalid discovery context" };
    }
    const collection = new AuthorizedCatalogCollection(
      this.catalog, this.registry, this.properties,
      source, options.origin ?? "user");
    const query = new CatalogQuery(collection);
    let result;
    if (command === "list") {
      result = query.list(kind, selector);
    } else if (command === "query") {
      result = query.query(kind, selector, options);
    } else if (command === "describe") {
      result = query.describe(kind, selector?.id,
        selector?.owner ?? null);
    } else {
      result = { ok: false, status: 400,
        error: "Unsupported catalog command" };
    }
    this.omu.record(result.ok ? "Log" : "EHU",
      source, "Catalog." + command, result.status, kind);
    return result;
  }

  registerProperty(name, value, options = {}) {
    const result = this.registry.registerProperty(name, value, options);
    this.omu.record(result.ok ? "Log" : "EHU", "HubUnit",
      "RegisterProperty." + name, result.status);
    return result;
  }

  readProperty(source, name) {
    if (!this.registry.resolve(source).ok) {
      this.omu.record("EHU", source, "Property.Read", 404, name);
      return { ok: false, status: 404 };
    }
    const definition = this.properties.describe(name);
    if (!definition) {
      this.omu.record("EHU", source, "Property.Read", 404, name);
      return { ok: false, status: 404 };
    }
    const permitted = definition.visibility === "Public" ||
      definition.owners.some(owner => AccessPolicy.canInvoke(
        source, owner, definition.visibility));
    if (!permitted) {
      this.omu.record("EHU", source, "Property.Read", 403, name);
      return { ok: false, status: 403 };
    }
    this.omu.record("Log", source, "Property.Read", 200, name);
    return { ok: true, status: 200, value: this.properties.get(name) };
  }

  publishProperty(name, value) {
    const result = this.properties.update(name, value);
    this.omu.record(result.ok ? "Log" : "EHU", "HubUnit",
      "Property." + name, result.status);
    return result;
  }
}
