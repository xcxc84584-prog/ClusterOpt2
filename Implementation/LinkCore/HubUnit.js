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
    if (!AccessPolicy.canUseAction(source, target, action, receiver.value)) {
      this.omu.record("EHU", source, "Request." + action, 403,
        target, { error: "Access denied" });
      return { ok: false, status: 403, error: "Access denied" };
    }
    // Serialize each destination object; independent destinations can overlap.
    // No caller may override the target-derived key.
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
          this.omu.record("EHU", target, "Response." + action, 500,
            source, { error: String(error) });
          return { ok: false, status: 500, error: String(error) };
        }
      }, { signal: options.signal });
    } catch (error) {
      const status = error.name === "AbortError" ? 499 : 429;
      this.omu.record("EHU", source, "Schedule." + action, status,
        target, { error: String(error) });
      return { ok: false, status, error: String(error) };
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
