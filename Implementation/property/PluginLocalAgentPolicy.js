import { PluginModelTaskPolicy } from "./PluginModelTaskPolicy.js";

/**
 * PR14.4: strict local-agent transport contract.
 * This is validation only; no authority, token or socket is stored here.
 */
const HEX = /^[a-f0-9]{64}$/i;
const SAFE = new Set(["ready", "pong", "error",
  "provider_info", "task_status", "task_result",
  "bridge_registered", "tool_call",
  "powershell_execution_result"]);
export const PluginLocalAgentPolicy = Object.freeze({
  address: "ws://127.0.0.1:43879/agent",
  validPort(value) {
    return Number.isInteger(value) && value >= 1024 &&
      value <= 65535;
  },
  addressForPort(port) {
    if (!this.validPort(port)) throw TypeError("Invalid Agent port");
    return "ws://127.0.0.1:" + port + "/agent";
  },
  maxMessageBytes: 160000,
  authTimeoutMs: 10000,
  pingTimeoutMs: 5000,
  validToken(value) {
    return typeof value === "string" && HEX.test(value);
  },
  inspectMessage(value) {
    if (typeof value !== "string" || value.length > 160000) {
      return { ok: false, status: 413 };
    }
    let message;
    try { message = JSON.parse(value); }
    catch { return { ok: false, status: 400 }; }
    if (!message || typeof message !== "object" ||
        Array.isArray(message) || !SAFE.has(message.type)) {
      return { ok: false, status: 403 };
    }
    if (message.type !== "powershell_execution_result" &&
        value.length > 65536) {
      return { ok: false, status: 413 };
    }
    if (message.type === "powershell_execution_result") {
      const output = message.result;
      const valid = typeof message.command === "string" &&
        message.command.length <= 2000 &&
        ((output && typeof output === "object" &&
          !Array.isArray(output) &&
          (typeof output.stdout === "string" &&
           output.stdout.length <= 65536) &&
          (typeof output.stderr === "string" &&
           output.stderr.length <= 65536)) ||
         (typeof message.error === "string" &&
          message.error.length <= 512));
      if (!valid) return { ok: false, status: 400 };
    }
    if (["provider_info", "task_status", "task_result"]
      .includes(message.type) &&
        !PluginModelTaskPolicy.taskMessage(message)) {
      return { ok: false, status: 400 };
    }
    if (message.type === "tool_call" && (
        typeof message.requestId !== "string" ||
        !/^[a-zA-Z0-9-]{1,100}$/.test(message.requestId) ||
        typeof message.name !== "string" ||
        message.name.length > 100 ||
        !message.args || typeof message.args !== "object" ||
        Array.isArray(message.args))) {
      return { ok: false, status: 403 };
    }
    if (message.type === "pong" &&
        (typeof message.requestId !== "string" ||
         !/^[a-f0-9-]{36}$/i.test(message.requestId))) {
      return { ok: false, status: 400 };
    }
    return { ok: true, status: 200, value: message };
  }
});
