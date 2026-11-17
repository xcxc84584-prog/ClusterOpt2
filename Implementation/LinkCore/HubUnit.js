import { ParallelExecutionPolicy } from "../property/ParallelExecutionPolicy.js";
import { AccessPolicy } from "../property/AccessPolicy.js";
import { ProviderSharedPropertyPolicy } from
  "../property/ProviderSharedPropertyPolicy.js";
import { ProviderManifestPolicy } from
  "../property/ProviderManifestPolicy.js";
import { ExecutionScheduler } from "./ExecutionScheduler.js";
import { ServiceRegistry } from "./ServiceRegistry.js";
import { ServiceRequestResolver } from "./ServiceRequestResolver.js";
import { RouteTablePolicy } from
  "../property/RouteTablePolicy.js";
import { RouteContractPolicy } from
  "../property/RouteContractPolicy.js";
import { ResponsePipelinePolicy } from
  "../property/ResponsePipelinePolicy.js";
import { RouteControlPolicy } from
  "../property/RouteControlPolicy.js";
import { RouteQueryPolicy } from
  "../property/RouteQueryPolicy.js";
import { CatalogQuery } from "./CatalogQuery.js";
import { AuthorizedCatalogCollection } from
  "./AuthorizedCatalogCollection.js";

/**
 * Hub-only request/response crossing, registration and event observation.
 * A missing target may be registered only from a trusted predeclared factory.
 */
export class HubUnit {
  constructor(registry, properties, omu,
    scheduler = new ExecutionScheduler(), catalog = null,
    services = null) {
    this.registry = registry;
    this.properties = properties;
    this.omu = omu;
    this.scheduler = scheduler;
    this.waitEdges = new Map();
    this.catalog = catalog;
    this.serviceResolver = new ServiceRequestResolver(
      services ?? new ServiceRegistry(registry), registry);
    // Internal-only declarative snapshot; URU remains Provider authority.
    this.replaceRoutes = Object.freeze([]);
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
    let parsed;
    try {
      parsed = ProviderManifestPolicy.validate(manifest);
    } catch (_error) {
      parsed = { ok: false, status: 400,
        error: "Invalid provider Manifest" };
    }
    if (!parsed.ok) {
      this.omu.record("EHU", source, "Provider.Register", parsed.status);
      return parsed;
    }
    if (source !== parsed.value.objectId) {
      this.omu.record("EHU", source, "Provider.Register", 403);
      return { ok: false, status: 403, error: "Provider owner mismatch" };
    }
    const claims = ProviderSharedPropertyPolicy.inspect(
      parsed.value, this.properties);
    const result = claims.ok ?
      this.registry.registerProvider(parsed.value) : claims;
    this.omu.record(result.ok ? "Log" : "EHU", source,
      "Provider.Register", result.status, parsed.value.providerId);
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

  /**
   * Trusted LinkCore configuration boundary. PR04.08 will add a
   * separately authorized external route-control API. This operation
   * does not become a Cluster.api method.
   *
   * Validate the entire table before a single synchronous swap.
   * Neither invalid entries nor inactive Providers can partially apply.
   */
  configureReplaceRoutes(candidate) {
    return this.configureServiceRoutes(candidate, true);
  }

  /**
   * PR04.08: trusted host-only, caller-scoped route configuration.
   * This is not an authenticated browser or Agent API. The host must
   * supply the verified caller identity. Other owners remain intact.
   */
  configureOwnedRoutes(source, candidate) {
    const parsed = RouteTablePolicy.validate(candidate);
    if (!parsed.ok) {
      this.omu.record("EHU", source ?? "unknown",
        "Service.Route.OwnedConfigure", parsed.status);
      return parsed;
    }
    const allowed = RouteControlPolicy.scoped(
      source, parsed.value.routes, this.registry);
    if (!allowed.ok) {
      this.omu.record("EHU", source ?? "unknown",
        "Service.Route.OwnedConfigure", allowed.status);
      return allowed;
    }
    const existing = this.replaceRoutes.filter(route =>
      route.sourceFilter.objects.length === 1 &&
      route.sourceFilter.objects[0] === source);
    const existingControl = RouteControlPolicy.scoped(
      source, existing, this.registry);
    if (!existingControl.ok) {
      this.omu.record("EHU", source,
        "Service.Route.OwnedConfigure", 403);
      return { ok: false, status: 403,
        error: "Existing route owned by another authority" };
    }
    const remaining = this.replaceRoutes.filter(route =>
      route.sourceFilter.objects.length !== 1 ||
      route.sourceFilter.objects[0] !== source);
    const merged = { schemaVersion: 1,
      routes: [...remaining, ...parsed.value.routes] };
    const result = this.configureServiceRoutes(merged);
    this.omu.record(result.ok ? "Log" : "EHU", source,
      "Service.Route.OwnedConfigure", result.status);
    return result;
  }

  /**
   * PR04.09: only route descriptors owned by the registered caller
   * are enumerated. Preview is a no-execution, no-payload ACL probe.
   */
  inspectRoutes(source, command, input, origin = "user") {
    if (typeof source !== "string" ||
        !this.registry.objects.has(source)) {
      this.omu.record("EHU", "unknown",
        "Service.Route.Inspect", 404);
      return { ok: false, status: 404 };
    }
    if (!["user", "agent"].includes(origin)) {
      this.omu.record("EHU", source,
        "Service.Route.Inspect", 400);
      return { ok: false, status: 400 };
    }
    const parsed = RouteQueryPolicy.parse(command, input);
    if (!parsed.ok) {
      this.omu.record("EHU", source,
        "Service.Route.Inspect", parsed.status);
      return parsed;
    }
    // An explicit per-caller route may still be host-configured with a
    // foreign Provider. Do not expose those descriptors to the caller.
    const owned = this.replaceRoutes.filter(route =>
      route.sourceFilter.objects.length === 1 &&
      route.sourceFilter.objects[0] === source &&
      route.sourceFilter.origins.includes(origin) &&
      RouteControlPolicy.scoped(
        source, [route], this.registry).ok);
    const publicRoute = route => Object.freeze({
      routeId: route.routeId, service: route.service,
      action: route.action, mode: route.mode,
      priority: route.priority
    });
    let result;
    if (command === "list") {
      const { offset, limit } = parsed.value;
      result = { ok: true, status: 200, value: Object.freeze({
        total: owned.length,
        routes: Object.freeze(
          owned.slice(offset, offset + limit).map(publicRoute))
      }) };
    } else if (command === "describe") {
      const route = owned.find(item =>
        item.routeId === parsed.value.routeId);
      result = route ?
        { ok: true, status: 200, value: publicRoute(route) } :
        { ok: false, status: 404 };
    } else {
      const { service, action } = parsed.value;
      const resolved = this.serviceResolver.resolve(
        service, action, source, origin, this.replaceRoutes);
      if (!resolved.ok) {
        result = { ok: false, status: resolved.status };
      } else {
        const stages = [
          ...(resolved.value.stages ?? [resolved.value]),
          ...(resolved.value.responsePipeline ?? [])
        ];
        const api = origin === "user" ? "UserAPI" : "AgentAPI";
        const allowed = stages.every(stage => {
          const object = this.registry.objects.get(stage.objectId);
          return object?.ocda?.[api]?.includes(action) &&
            AccessPolicy.canUseAction(
              source, stage.objectId, action, object);
        });
        const visible = owned.find(route =>
          route.routeId === resolved.value.routeId);
        result = allowed ?
          { ok: true, status: 200, value: Object.freeze({
            service, action, mode: resolved.value.mode ?? "direct",
            routeId: visible?.routeId ?? null,
            stages: stages.length, executable: true
          }) } : { ok: false, status: 403 };
      }
    }
    this.omu.record(result.ok ? "Log" : "EHU", source,
      "Service.Route." + command, result.status);
    return result;
  }

  /**
   * Trusted declarative route activation. PR04.04/05: chain/fanout
   * cannot bypass HubUnit.request or mint a caller identity.
   */
  configureServiceRoutes(candidate, replaceOnly = false) {
    const parsed = RouteTablePolicy.validate(candidate);
    if (!parsed.ok) {
      this.omu.record("EHU", "LinkCore", "Service.Route.Configure",
        parsed.status);
      return parsed;
    }
    if (!parsed.value.routes.every(route =>
      route.mode === "replace" ||
      (!replaceOnly && ["chain", "fanout", "observe"].includes(route.mode)))) {
      this.omu.record("EHU", "LinkCore", "Service.Route.Configure", 400);
      return { ok: false, status: 400,
        error: "Unsupported executable route mode" };
    }
    for (const route of parsed.value.routes) {
      // Observe always has one primary and at least one independent observer.
      if (route.mode === "observe" && route.providers.length < 2) {
        this.omu.record("EHU", "LinkCore",
          "Service.Route.Configure", 400, route.routeId);
        return { ok: false, status: 400,
          error: "Observe requires primary and observer" };
      }
      const found = this.serviceResolver.services.resolve(route.service);
      const contracts = [];
      for (const id of route.providers) {
        const provider = found.ok && found.value.find(item =>
          item.providerId === id &&
          this.registry.objects.has(item.objectId));
        const contract = provider && provider.provides.find(item =>
          item.service === route.service &&
          item.action === route.action);
        if (!contract) {
          this.omu.record("EHU", "LinkCore",
            "Service.Route.Configure", 404, route.routeId);
          return { ok: false, status: 404,
            error: "Route Provider unavailable" };
        }
        contracts.push(contract);
      }
      if (route.mode === "chain" && contracts.some((item, index) =>
        index > 0 && !RouteContractPolicy.compatible(
          contracts[index - 1].outputSchema, item.inputSchema))) {
        this.omu.record("EHU", "LinkCore",
          "Service.Route.Configure", 409, route.routeId);
        return { ok: false, status: 409,
          error: "Chain contract mismatch" };
      }
      let previous = route.mode === "fanout" ?
        ResponsePipelinePolicy.fanoutSchema :
        route.mode === "chain" ?
          contracts[contracts.length - 1].outputSchema :
          contracts[0].outputSchema;
      for (const stage of route.responsePipeline ?? []) {
        const provider = found.ok && found.value.find(item =>
          item.providerId === stage.providerId &&
          this.registry.objects.has(item.objectId));
        const contract = provider && provider.provides.find(item =>
          item.service === route.service &&
          item.action === route.action);
        if (!contract) {
          this.omu.record("EHU", "LinkCore",
            "Service.Route.Configure", 404, route.routeId);
          return { ok: false, status: 404,
            error: "Response Provider unavailable" };
        }
        if (!RouteContractPolicy.compatible(
          previous, contract.inputSchema) ||
            (stage.kind === "validate" &&
             !RouteContractPolicy.compatible(
               contract.outputSchema,
               ResponsePipelinePolicy.booleanSchema))) {
          this.omu.record("EHU", "LinkCore",
            "Service.Route.Configure", 409, route.routeId);
          return { ok: false, status: 409,
            error: "Response Pipeline contract mismatch" };
        }
        if (stage.kind !== "validate") {
          previous = contract.outputSchema;
        }
      }
    }
    const graph = RouteControlPolicy.cycles(
      parsed.value.routes, this.registry);
    if (!graph.ok) {
      this.omu.record("EHU", "LinkCore",
        "Service.Route.Configure", graph.status,
        "HubUnit", { error: graph.error });
      return graph;
    }
    // Existing in-flight requests hold their already resolved Object.
    this.replaceRoutes = parsed.value.routes;
    this.omu.record("Log", "LinkCore",
      "Service.Route.Configure", 200, "HubUnit",
      { count: this.replaceRoutes.length });
    return { ok: true, status: 200,
      value: Object.freeze({ count: this.replaceRoutes.length }) };
  }

  /**
   * Map a logical Service to one Object, then reuse the entire
   * existing Hub request, authorization, scheduler and EHU path.
   */
  async requestService(source, service, action,
    payload = {}, options = {}) {
    if (typeof source !== "string" ||
        !this.registry.objects.has(source)) {
      this.omu.record("EHU", "unknown", "Service.Request", 404,
        typeof service === "string" ? service : "");
      return { ok: false, status: 404,
        error: "Sender not registered" };
    }
    if (!options || typeof options !== "object" ||
        Array.isArray(options)) {
      this.omu.record("EHU", source, "Service.Resolve", 400,
        typeof service === "string" ? service : "");
      return { ok: false, status: 400,
        error: "Invalid request options" };
    }
    const origin = options.origin === "user" ||
      options.origin === "agent" ? options.origin : null;
    const route = this.serviceResolver.resolve(
      service, action, source, origin, this.replaceRoutes);
    if (!route.ok) {
      this.omu.record("EHU", source, "Service.Resolve",
        route.status, typeof service === "string" ? service : "",
        { error: route.error });
      return route;
    }
    this.omu.record("Log", source, "Service.Resolve", 200,
      route.value.objectId, {
        service: route.value.service,
        providerId: route.value.providerId
      });
    let result;
    if (route.value.mode === "chain") {
      result = await this.executeChain(source, route.value,
        payload, options);
    } else if (route.value.mode === "fanout") {
      result = await this.executeFanout(source, route.value,
        payload, options);
    } else if (route.value.mode === "observe") {
      result = await this.executeObserve(source, route.value,
        payload, options);
    } else {
      result = await this.request(source, route.value.objectId,
        route.value.action, payload, options);
    }
    if (!result.ok || !route.value.responsePipeline?.length) {
      return result;
    }
    return this.executeResponsePipeline(source, route.value,
      result, options);
  }


  /**
   * Each hop invokes the pre-existing guarded Hub request. Every
   * successful output is checked before becoming the next input.
   */
  async executeChain(source, route, payload, options) {
    let current = payload;
    for (const [index, stage] of route.stages.entries()) {
      if (!RouteContractPolicy.validate(
        current, stage.inputSchema)) {
        return this.routeFailure(source, route, 422,
          "Chain input contract failed", index);
      }
      const result = await this.request(
        source, stage.objectId, route.action, current, options);
      if (!result.ok) return result;
      if (!RouteContractPolicy.validate(
        result.value, stage.outputSchema)) {
        return this.routeFailure(source, route, 502,
          "Chain output contract failed", index);
      }
      current = result.value;
    }
    return { ok: true, status: 200, value: current };
  }

  /**
   * Bounded async fanout. Output order follows the declared providers,
   * independent of completion order. Fail closed on any failed branch.
   * Cancellation of executing tasks belongs to the later runtime gate.
   */
  async executeFanout(source, route, payload, options) {
    for (const [index, stage] of route.stages.entries()) {
      if (!RouteContractPolicy.validate(
        payload, stage.inputSchema)) {
        return this.routeFailure(source, route, 422,
          "Fanout input contract failed", index);
      }
    }
    const results = await Promise.all(route.stages.map(stage =>
      this.request(source, stage.objectId,
        route.action, payload, options)));
    const values = [];
    for (const [index, result] of results.entries()) {
      if (!result.ok) {
        return this.routeFailure(source, route, result.status,
          "Fanout Provider failure", index);
      }
      if (!RouteContractPolicy.validate(result.value,
        route.stages[index].outputSchema)) {
        return this.routeFailure(source, route, 502,
          "Fanout output contract failed", index);
      }
      values.push(Object.freeze({
        providerId: route.stages[index].providerId,
        value: result.value
      }));
    }
    return { ok: true, status: 200,
      value: Object.freeze(values) };
  }

  /**
   * PR04.06: Only the primary gets application data. Observers receive
   * minimal, primitive-only metadata after successful primary execution.
   * They are asynchronous and can neither mutate nor delay its result.
   * All dispatches still pass through the guarded Hub request.
   */
  async executeObserve(source, route, payload, options) {
    const [primary, ...observers] = route.stages;
    if (!RouteContractPolicy.validate(payload, primary.inputSchema)) {
      return this.routeFailure(source, route, 422,
        "Observe primary input contract failed", 0);
    }
    const result = await this.request(source, primary.objectId,
      route.action, payload, options);
    if (!result.ok) return result;
    if (!RouteContractPolicy.validate(result.value, primary.outputSchema)) {
      return this.routeFailure(source, route, 502,
        "Observe primary output contract failed", 0);
    }
    // Do not forward payload, response, origin or source identity.
    const event = Object.freeze({
      service: route.service,
      action: route.action,
      status: result.status,
      ok: true
    });
    for (const [index, observer] of observers.entries()) {
      // Rejected contract is an observation failure, not a primary failure.
      if (!RouteContractPolicy.validate(event, observer.inputSchema)) {
        this.routeObservationFailure(source, route, 422, index + 1);
        continue;
      }
      // Detached dispatch: no Promise is returned to the primary caller.
      // Catch all exceptions and log failures to avoid unhandled rejection.
      Promise.resolve().then(() => this.request(
        source, observer.objectId, route.action, event, options
      )).then(observed => {
        if (!observed.ok) {
          this.routeObservationFailure(
            source, route, observed.status, index + 1);
        } else if (!RouteContractPolicy.validate(
          observed.value, observer.outputSchema)) {
          this.routeObservationFailure(source, route, 502, index + 1);
        }
      }).catch(() => {
        this.routeObservationFailure(source, route, 500, index + 1);
      });
    }
    return result;
  }

  /**
   * PR04.07: response-only, bounded sequential contract pipeline.
   * Each trusted Provider sees detached validated value, never the
   * original Hub REP envelope or caller identity as payload.
   */
  async executeResponsePipeline(source, route, primary, options) {
    let value = primary.value;
    for (const [index, stage] of route.responsePipeline.entries()) {
      if (!RouteContractPolicy.validate(value, stage.inputSchema)) {
        return this.routeFailure(source, route, 502,
          "Response input contract failed", index);
      }
      const input = ResponsePipelinePolicy.clone(value);
      const response = await this.request(source, stage.objectId,
        route.action, input, options);
      if (!response.ok) return response;
      if (!RouteContractPolicy.validate(
        response.value, stage.outputSchema)) {
        return this.routeFailure(source, route, 502,
          "Response output contract failed", index);
      }
      if (stage.kind === "validate") {
        if (response.value !== true) {
          return this.routeFailure(source, route, 422,
            "Response validation rejected", index);
        }
      } else {
        value = ResponsePipelinePolicy.clone(response.value);
      }
    }
    // Keep original request/response status and provenance. Providers
    // cannot construct or overwrite the protected envelope.
    return { ...primary, value };
  }

  routeObservationFailure(source, route, status, stage) {
    this.omu.record("EHU", source, "Service.Route.Observe",
      status, route.routeId, { stage });
  }

  routeFailure(source, route, status, error, stage) {
    this.omu.record("EHU", source,
      "Service.Route.Execute", status, route.routeId,
      { stage, error });
    return { ok: false, status, error };
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
