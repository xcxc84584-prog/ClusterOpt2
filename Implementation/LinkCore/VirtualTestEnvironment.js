/**
 * VTE: a detached memory-only test domain.
 * Never imports the production singleton or touches browser file handles.
 */
import { LinkCore } from "./LinkCore.js";
import { UICOVTERunner } from "./UICOVTERunner.js";

export class VirtualTestEnvironment {
  constructor() {
    this.core = new LinkCore();
    this.objects = new Map();
    this.core.register({ id: "VTE", receive: async () => null });
  }

  create(name, behavior = async (_action, payload) => payload) {
    if (!name || typeof name !== "string" ||
        typeof behavior !== "function" || this.objects.has(name)) {
      return { ok: false, status: 409 };
    }
    const object = {
      id: "VTE." + name,
      receive: behavior,
      authorization: { default: "Public" }
    };
    const registered = this.core.register(object);
    if (registered) this.objects.set(name, object);
    return { ok: registered, status: registered ? 201 : 409 };
  }

  update(name, behavior) {
    const object = this.objects.get(name);
    if (!object || typeof behavior !== "function") {
      return { ok: false, status: 404 };
    }
    object.receive = behavior;
    return { ok: true, status: 200 };
  }

  delete(name) {
    if (!this.objects.has(name)) return { ok: false, status: 404 };
    this.core.unregister("VTE." + name);
    this.objects.delete(name);
    return { ok: true, status: 200 };
  }

  async act(source, target, action, payload = {}) {
    return this.core.request("VTE." + source, "VTE." + target,
      action, payload);
  }

  log() {
    return this.core.getSnapshot().logs;
  }

  snapshot() {
    return this.core.getSnapshot();
  }
}

/** Read-only global methods except explicit VTE sandbox operations. */
export function exposeVTE(win, core = null) {
  const sandbox = new VirtualTestEnvironment();
  let storage = null;
  try {
    storage = win.localStorage ?? null;
  } catch {
    // Browser storage may be denied by policy; VTE remains available.
  }
  const runner = core ? new UICOVTERunner(core,
    () => new VirtualTestEnvironment(), storage) : null;
  Object.defineProperty(win, "VTE", {
    configurable: false,
    writable: false,
    value: Object.freeze({
      C: (id) => sandbox.create(id),
      U: (id) => sandbox.update(id, async (_a, payload) => payload),
      D: (id) => sandbox.delete(id),
      A: (source, target, action, data) =>
        sandbox.act(source, target, action, data),
      log: () => sandbox.log(),
      rep: () => sandbox.snapshot().dependencies,
      objectlist: () => sandbox.snapshot().objects,
      UICO_TEST: () => runner ? runner.run(true) :
        Promise.resolve({ status: "UNAVAILABLE" })
    })
  });
  if (runner) runner.startup();
}
