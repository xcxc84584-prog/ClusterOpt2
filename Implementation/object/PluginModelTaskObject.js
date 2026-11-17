import { PluginModelTaskPolicy as Policy } from
  "../property/PluginModelTaskPolicy.js";

/**
 * PR14.5 OCDA model/task controller. The Windows Agent owns API keys
 * and model inference. This Object owns only transient task metadata.
 * Transport calls use HubUnit Request/Response, never a direct socket.
 */
export class PluginModelTaskObject {
  constructor(core, providerId, localAgentId, publish = () => {}) {
    this.core = core;
    this.providerId = providerId;
    this.localAgentId = localAgentId;
    this.id = "PluginModelTask." +
      providerId.replace(/[^a-zA-Z0-9]/g, "_");
    this.strictOCDA = true;
    this.authorization = {
      default: "Private", configure: "Public", modelInfo: "Public",
      submit: "Public", cancel: "Public", state: "Public",
      ingest: "Public", reset: "Public"
    };
    this.ocda = {
      EHU: [], Log: [],
      Request: ["configure", "modelInfo", "submit", "cancel",
        "state", "ingest", "reset"],
      Response: ["configure", "modelInfo", "submit", "cancel",
        "state", "ingest", "reset"],
      UserAPI: ["configure", "modelInfo", "submit", "cancel", "state"],
      AgentAPI: [], Property: [],
      Program: "PluginModelTaskObject"
    };
    this.publish = publish;
    this.configured = false;
    this.model = "";
    this.activeId = null;
    this.activeStatus = "idle";
    this.history = [];
  }

  fail(status, label) {
    this.core.omu.record("EHU", this.id,
      "Plugin.Model." + label, status, this.providerId);
    const error = new Error("Model operation rejected");
    error.status = status;
    throw error;
  }

  async relay(action, payload = {}) {
    return this.core.request(this.id, this.localAgentId,
      action, payload);
  }

  has(name) {
    return this.core.checkPluginPermission(this.providerId, name);
  }

  snapshot() {
    return {
      configured: this.configured, model: this.model,
      activeId: this.activeId, status: this.activeStatus
    };
  }

  notify(kind, details) {
    this.publish({ kind, ...details });
  }

  receive(action, payload = {}, context = {}) {
    if (context.source !== "ui" &&
        !(action === "ingest" &&
          context.source === this.localAgentId)) {
      return this.fail(403, "SourceDenied");
    }
    if (action === "reset" &&
        context.source === this.localAgentId) {
      this.reset();
      return { reset: true };
    }
    if (action === "ingest") return this.ingest(payload);
    if (action === "state") return this.snapshot();
    if (action === "configure" || action === "modelInfo") {
      return this.configure(action);
    }
    if (action === "submit") return this.submit(payload);
    if (action === "cancel") return this.cancel();
    return this.fail(404, "UnknownAction");
  }

  async configure(action) {
    if (!this.has("model.configure")) return this.fail(403, "Denied");
    const method = action === "configure" ?
      "providerSet" : "providerGet";
    const result = await this.relay(method);
    if (!result.ok) return this.fail(result.status, "Provider");
    return this.snapshot();
  }

  async submit(payload) {
    if (!this.has("model.task")) return this.fail(403, "Denied");
    if (this.activeId) return this.fail(409, "Busy");
    if (!Policy.promptValid(payload?.prompt)) {
      return this.fail(400, "PromptInvalid");
    }
    const requestId = globalThis.crypto.randomUUID();
    if (!Policy.requestIdValid(requestId)) {
      return this.fail(500, "RequestIdInvalid");
    }
    this.activeId = requestId;
    this.activeStatus = "queued";
    this.notify("task", { status: "queued", requestId });
    const result = await this.relay("taskStart", {
      requestId, prompt: payload.prompt
    });
    if (!result.ok) {
      this.activeId = null;
      this.activeStatus = "failed";
      this.notify("task", { status: "failed", requestId });
      return this.fail(result.status, "SendFailed");
    }
    return { requestId, status: "queued" };
  }

  async cancel() {
    if (!this.has("model.task")) return this.fail(403, "Denied");
    if (!this.activeId) return this.fail(409, "NoTask");
    const requestId = this.activeId;
    const result = await this.relay("taskCancel", { requestId });
    if (!result.ok) return this.fail(result.status, "CancelFailed");
    this.activeStatus = "cancelling";
    this.notify("task", { status: "cancelling", requestId });
    return { requestId, status: "cancelling" };
  }

  ingest(message) {
    if (!Policy.taskMessage(message)) {
      return this.fail(400, "MessageInvalid");
    }
    const value = Policy.redactedTaskResult(message);
    if (message.type === "provider_info") {
      this.configured = value.configured;
      this.model = value.model;
      this.notify("model", value);
      return { accepted: true };
    }
    if (!this.activeId || this.activeId !== value.requestId) {
      return this.fail(409, "UnmatchedTask");
    }
    if (message.type === "task_result") {
      this.notify("result", value);
    } else {
      this.activeStatus = value.status;
      this.notify("task", value);
      if (["completed", "failed", "interrupted"].includes(value.status)) {
        this.activeId = null;
      }
    }
    return { accepted: true };
  }

  reset() {
    this.activeId = null;
    this.activeStatus = "idle";
    this.configured = false;
    this.model = "";
    this.notify("reset", { status: "idle" });
  }
}
