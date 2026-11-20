/**
 * Isolated classic Worker bootstrap.
 * Host request capability is available only after a port-bound handshake.
 * This script never imports a host URL or acquires a DOM reference.
 */
export const PluginWorkerSource = String.raw`
"use strict";
let channel = null;
let plugin = null;
let sequence = 0;
let sessionReady = false;
let resolveReady;
const ready = new Promise(resolve => { resolveReady = resolve; });
const pending = new Map();
const handlers = new Map();
const sessionListeners = new Set();
const allowedActions = new Set();
const protocol = "cluster.rpc/1";

class PluginRPCError extends Error {
  constructor(code, status = 500) {
    super(code);
    this.name = "PluginRPCError";
    this.code = code;
    this.status = status;
  }
}

function notifySession(state) {
  for (const listener of [...sessionListeners]) {
    try { listener(state); }
    catch { /* An extension listener never breaks channel state. */ }
  }
}

function rejectPending(reason) {
  for (const task of pending.values()) {
    task.reject(reason);
  }
  pending.clear();
}

self.Cluster = Object.freeze({
  version: "1.0.0",
  RPCError: PluginRPCError,
  ready,
  onSessionChange(listener) {
    if (typeof listener !== "function") {
      throw TypeError("Session listener must be callable");
    }
    sessionListeners.add(listener);
    return () => sessionListeners.delete(listener);
  },
  handle(action, handler) {
    if (!allowedActions.has(action) ||
        typeof handler !== "function" ||
        handlers.has(action)) {
      throw TypeError("Undeclared or duplicate plugin handler");
    }
    handlers.set(action, handler);
    return () => handlers.delete(action);
  },
  service(target, action, payload = {}, options = {}) {
    return this.request(target, action, payload, options);
  },
  request: async (target, action, payload = {}, options = {}) => {
    await ready;
    if (!sessionReady || !channel) {
      throw Error("Plugin session unavailable");
    }
    const requestId = "plugin-" + ++sequence;
    const deadlineMs = options.deadlineMs ?? 5000;
    if (!Number.isSafeInteger(deadlineMs) ||
        deadlineMs < 1 || deadlineMs > 30000) {
      throw TypeError("Invalid deadline");
    }
    if (options.signal?.aborted) throw Error("RPC cancelled");
    return new Promise((resolve, reject) => {
      let done = false;
      let timer = null;
      const signal = options.signal;
      const finish = (success, value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        signal?.removeEventListener?.("abort", abort);
        pending.delete(requestId);
        if (success) resolve(value);
        else reject(value instanceof Error ? value :
          new PluginRPCError(String(value), 500));
      };
      const abort = () => {
        try {
          channel.postMessage({
            protocol, direction: "plugin-to-host",
            type: "cancel", requestId, reason: "ABORTED"
          });
        } catch {
          // A disconnected transport still settles the local Promise.
        }
        finish(false, "RPC cancelled");
      };
      timer = setTimeout(() => {
        abort();
      }, deadlineMs);
      pending.set(requestId, {
        resolve: data => finish(true, data),
        reject: reason => finish(false, reason)
      });
      signal?.addEventListener?.("abort", abort, { once: true });
      if (signal?.aborted) {
        abort();
        return;
      }
      try {
        channel.postMessage({
          protocol, direction: "plugin-to-host",
          type: "request", requestId, target, action,
          payload, deadlineMs
        });
      } catch {
        finish(false, "RPC transport failed");
      }
    });
  }
});

self.addEventListener("message", async event => {
  if (channel || event.data?.kind !== "start" ||
      event.ports.length !== 1) return;
  channel = event.ports[0];
  channel.onmessage = async ({data}) => {
    if (data?.kind === "cluster-session-suspended") {
      sessionReady = false;
      rejectPending("Plugin session suspended");
      notifySession("suspended");
      return;
    }
    if (data?.kind === "cluster-session-hello") {
      if (data.protocol !== protocol ||
          typeof data.challenge !== "string") return;
      channel.postMessage({
        kind: "cluster-session-ready", protocol,
        challenge: data.challenge
      });
      sessionReady = true;
      resolveReady();
      notifySession("ready");
      return;
    }
    if (data?.protocol === protocol &&
        data.type === "response" &&
        data.direction === "plugin-to-host") {
      const task = pending.get(data.requestId);
      if (!task) return;
      if (data.ok) task.resolve(data.data);
      else task.reject(new PluginRPCError(
        data.error?.code ?? "RPC_DENIED", data.status));
      return;
    }
    if (data?.kind !== "invoke" ||
        !Number.isSafeInteger(data.id)) return;
    try {
      const fn = handlers.get(data.action) ??
        (Object.hasOwn(plugin, data.action) ?
          plugin[data.action] : null);
      if (typeof fn !== "function") {
        channel.postMessage({
          kind: "response", id: data.id,
          ok: false, status: 404
        });
        return;
      }
      const value = await fn(data.payload);
      channel.postMessage({
        kind: "response", id: data.id,
        ok: true, value: value ?? null
      });
    } catch {
      channel.postMessage({
        kind: "response", id: data.id,
        ok: false, status: 500
      });
    }
  };
  channel.start();
  try {
    if (typeof event.data.source !== "string") {
      throw Error("Source missing");
    }
    if (!Array.isArray(event.data.actions) ||
        event.data.actions.some(action =>
          typeof action !== "string" || !action)) {
      throw Error("Invalid exported action declaration");
    }
    for (const action of event.data.actions) {
      allowedActions.add(action);
    }
    const url = "data:text/javascript;charset=utf-8," +
      encodeURIComponent(event.data.source);
    plugin = await import(url);
    channel.postMessage({kind: "ready"});
  } catch {
    rejectPending("Plugin startup failed");
    channel.postMessage({kind: "error", status: 400});
  }
});
`;
