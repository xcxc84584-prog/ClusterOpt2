import { PluginMessagePolicy } from
  "../property/PluginMessagePolicy.js";
import { PluginSourcePolicy } from
  "../property/PluginSourcePolicy.js";

/**
 * One bounded request per trusted Worker; terminate at completion/timeout.
 * No direct Worker URL from a caller. No arbitrary code execution.
 */
const OPERATIONS = new Set(["echo", "lineCount"]);

export class TrustedPluginWorkerUnit {
  constructor(omu, workerFactory = null) {
    this.omu = omu;
    this.workerFactory = workerFactory ??
      (() => new Worker(new URL("../worker/TrustedPluginWorker.js",
        import.meta.url), { type: "module" }));
    this.active = 0;
    this.serial = 0;
  }

  record(status, operation) {
    this.omu.record(status < 400 ? "Log" : "EHU",
      "LinkCore", "Plugin.Worker.Invoke", status, operation);
  }

  async invoke(operation, payload, options = {}) {
    const src = PluginSourcePolicy.inspect({ kind: "builtin" });
    if (!src.ok || !OPERATIONS.has(operation) ||
        !options || typeof options !== "object" ||
        Array.isArray(options) ||
        Reflect.ownKeys(options).some(key => key !== "timeoutMs")) {
      this.record(400, "invalid");
      return { ok: false, status: 400 };
    }
    const timeoutMs = options.timeoutMs ?? 2000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10 ||
        timeoutMs > 5000) {
      this.record(400, operation);
      return { ok: false, status: 400 };
    }
    const checked = PluginMessagePolicy.inspect(payload);
    if (!checked.ok) {
      this.record(checked.status, operation);
      return checked;
    }
    if (this.active >= 8) {
      this.record(429, operation);
      return { ok: false, status: 429 };
    }
    this.active++;
    const id = ++this.serial;
    let worker;
    try {
      worker = this.workerFactory();
      if (!worker || typeof worker.postMessage !== "function" ||
          typeof worker.terminate !== "function") {
        throw Error("Worker unavailable");
      }
    } catch {
      this.active--;
      this.record(503, operation);
      return { ok: false, status: 503 };
    }
    return new Promise(resolve => {
      let settled = false;
      let timer;
      const finish = (status, value = null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { worker.terminate(); } catch { /* Release best effort. */ }
        this.active--;
        this.record(status, operation);
        resolve(status === 200 ? { ok: true, status, value } :
          { ok: false, status });
      };
      worker.onmessage = event => {
        const parsed = PluginMessagePolicy.inspect(event?.data);
        if (!parsed.ok) return finish(502);
        const message = parsed.value;
        if (!message || message.id !== id ||
            typeof message.ok !== "boolean") return finish(502);
        if (message.ok) {
          if (!Object.hasOwn(message, "value")) return finish(502);
          const value = PluginMessagePolicy.inspect(message.value);
          return value.ok ? finish(200, value.value) : finish(502);
        }
        return finish([400, 413].includes(message.status) ?
          message.status : 502);
      };
      worker.onerror = () => finish(502);
      worker.onmessageerror = () => finish(502);
      timer = setTimeout(() => finish(504), timeoutMs);
      try {
        worker.postMessage({ kind: "invoke", id, operation,
          payload: checked.value });
      } catch {
        finish(502);
      }
    });
  }
}
