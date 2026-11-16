import { ParallelExecutionPolicy } from "../property/ParallelExecutionPolicy.js";
import { AccessPolicy } from "../property/AccessPolicy.js";
import { ExecutionScheduler } from "./ExecutionScheduler.js";

/**
 * Hub-only request/response crossing, registration and event observation.
 * A missing target may be registered only from a trusted predeclared factory.
 */
export class HubUnit {
  constructor(registry, properties, omu, scheduler = new ExecutionScheduler()) {
    this.registry = registry;
    this.properties = properties;
    this.omu = omu;
    this.scheduler = scheduler;
    this.waitEdges = new Map();
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
