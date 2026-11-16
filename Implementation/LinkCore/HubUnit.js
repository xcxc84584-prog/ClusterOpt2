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
    if (!result.ok) {
      this.omu.record("EHU", object?.id ?? "unknown",
        "register", result.status);
    }
    return result.ok;
  }

  unregister(id) {
    return this.registry.unregister(id);
  }

  async request(source, target, action, payload = {}, options = {}) {
    const sender = this.registry.resolve(source);
    if (!sender.ok) {
      this.omu.record("EHU", source, action, sender.status, target, {
        error: "Sender not registered"
      });
      return { ok: false, status: sender.status, error: sender.error };
    }
    const receiver = this.registry.resolve(target);
    if (!receiver.ok) {
      this.omu.record("EHU", source, action, receiver.status, target, {
        error: receiver.error
      });
      return { ok: false, status: receiver.status, error: receiver.error };
    }
    // Serialize each destination object; independent destinations can overlap.
    // No caller may override the target-derived key.
    try {
      return await this.scheduler.schedule(target, async () => {
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

  publishProperty(name, value) {
    const result = this.properties.update(name, value);
    this.omu.record(result.ok ? "Log" : "EHU", "HubUnit",
      "Property." + name, result.status);
    return result;
  }
}
