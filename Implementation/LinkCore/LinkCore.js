/**
 * LinkCore: runtime registry, mediated requests/responses and in-memory OMU.
 * Dynamic registration is permitted only for locally constructed objects.
 * Reset occurs on each page reload.
 */
export class LinkCore {
  constructor() {
    this.registry = new Map();
    this.logs = [];
    this.dependencies = new Map();
    this.nextEventId = 1;
    this.lastPassByKey = new Map();
    this.version = "0.0.1-pr1";
  }

  register(object) {
    if (!object || typeof object.id !== "string" ||
        typeof object.receive !== "function") {
      this.record("EHU", "Registration", "INVALID_OBJECT", 400);
      return false;
    }
    if (this.registry.has(object.id) &&
        this.registry.get(object.id) !== object) {
      this.record("EHU", object.id, "ID_CONFLICT", 409);
      return false;
    }
    this.registry.set(object.id, object);
    return true;
  }

  unregister(id) {
    this.registry.delete(id);
  }

  record(kind, source, action, status, target = "") {
    const now = Date.now();
    const key = [kind, source, action, target].join("|");
    // Only successful ordinary logs are throttled. EHU/fail never are.
    if (kind === "Log" && status >= 200 && status < 300) {
      if (now - (this.lastPassByKey.get(key) ?? 0) < 1000) return;
      this.lastPassByKey.set(key, now);
    }
    this.logs.unshift({
      id: this.nextEventId++, time: new Date(now).toISOString(),
      kind, source, target, action, status
    });
    if (this.logs.length > 2000) this.logs.length = 2000;
  }

  async request(source, target, action, payload = {}) {
    const receiver = this.registry.get(target);
    if (!receiver) {
      this.record("EHU", source, action, 404, target);
      return { ok: false, status: 404, error: "Target is not registered" };
    }
    const relation = this.dependencies.get(source) ?? new Set();
    relation.add(target);
    this.dependencies.set(source, relation);
    try {
      const result = await receiver.receive(action, payload);
      this.record("Log", source, action, 200, target);
      return { ok: true, status: 200, value: result };
    } catch (error) {
      this.record("EHU", source, action, 500, target);
      return { ok: false, status: 500, error: String(error) };
    }
  }

  getSnapshot() {
    return {
      version: this.version,
      objects: [...this.registry.keys()],
      dependencies: [...this.dependencies].map(([source, targets]) =>
        ({ source, targets: [...targets] })),
      logs: [...this.logs]
    };
  }
}

export const linkCore = new LinkCore();
// Read-only inspection API. Mutations are routed through requests.
window.Cluster = Object.freeze({
  log: () => linkCore.getSnapshot().logs,
  objectlist: () => linkCore.getSnapshot().objects,
  propertylist: () => ["DocumentStatus"],
  rep: () => linkCore.getSnapshot().dependencies,
  version: () => linkCore.version
});
