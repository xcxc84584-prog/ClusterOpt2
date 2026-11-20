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
const protocol = "cluster.rpc/1";

function rejectPending(reason) {
  for (const task of pending.values()) {
    clearTimeout(task.timer);
    task.reject(Error(reason));
  }
  pending.clear();
}

self.Cluster = Object.freeze({
  ready,
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
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(Error("RPC timeout"));
      }, deadlineMs);
      pending.set(requestId, { resolve, reject, timer });
      try {
        channel.postMessage({
          protocol, direction: "plugin-to-host",
          type: "request", requestId, target, action,
          payload, deadlineMs
        });
      } catch {
        clearTimeout(timer);
        pending.delete(requestId);
        reject(Error("RPC transport failed"));
      }
    });
  }
});

self.addEventListener("message", async event => {
  if (channel || event.data?.kind !== "start" ||
      event.ports.length !== 1) return;
  channel = event.ports[0];
  channel.onmessage = async ({data}) => {
    if (data?.kind === "cluster-session-hello") {
      if (sessionReady || data.protocol !== protocol ||
          typeof data.challenge !== "string") return;
      channel.postMessage({
        kind: "cluster-session-ready", protocol,
        challenge: data.challenge
      });
      sessionReady = true;
      resolveReady();
      return;
    }
    if (data?.protocol === protocol &&
        data.type === "response" &&
        data.direction === "plugin-to-host") {
      const task = pending.get(data.requestId);
      if (!task) return;
      pending.delete(data.requestId);
      clearTimeout(task.timer);
      if (data.ok) task.resolve(data.data);
      else task.reject(Error(data.error?.code ?? "RPC denied"));
      return;
    }
    if (data?.kind !== "invoke" ||
        !Number.isSafeInteger(data.id)) return;
    try {
      const fn = Object.hasOwn(plugin, data.action) ?
        plugin[data.action] : null;
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
