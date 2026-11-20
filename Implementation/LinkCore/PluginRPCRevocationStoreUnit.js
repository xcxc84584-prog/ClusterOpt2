import { PluginRPCScopePolicy as Scopes } from
  "../property/PluginRPCScopePolicy.js";

/**
 * PR24.46: Host-private, deny-only persistence for revoked reverse RPC.
 * This is not a Provider registry, capability grant, or trust decision.
 * Only the Gateway's in-memory grants can authorize an actual request.
 */
const DATABASE = "clusteropt2-plugin-rpc-revocations";
const STORE = "denials";
const PROVIDER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_RECORDS = 2048;

function failure(status, errorCode) {
  return { ok: false, status, errorCode };
}

function inspect(providerId, scope) {
  if (typeof providerId !== "string" ||
      !PROVIDER.test(providerId)) return null;
  const checked = Scopes.inspect([scope]);
  if (!checked.ok) return null;
  const value = checked.value[0];
  return {
    id: JSON.stringify([
      providerId, value.target, value.action, value.property ?? null
    ]),
    providerId, scope: value
  };
}

export class PluginRPCRevocationStoreUnit {
  constructor(omu, indexedDB = globalThis.indexedDB) {
    this.omu = omu;
    this.indexedDB = indexedDB;
    this.listeners = new Set();
    this.channel = null;
  }

  /**
   * Broadcast only deny notifications, never grants. Every receiver
   * must re-read IndexedDB rather than trusting the event payload.
   */
  subscribe(listener) {
    if (typeof listener !== "function") {
      throw TypeError("Invalid RPC denial listener");
    }
    this.listeners.add(listener);
    if (!this.channel && this.indexedDB &&
        typeof window !== "undefined" &&
        typeof BroadcastChannel === "function") {
      this.channel = new BroadcastChannel(
        "clusteropt2-rpc-denials");
      this.channel.onmessage = event => {
        if (event.data?.kind !== "deny" ||
            typeof event.data?.providerId !== "string") return;
        for (const notify of [...this.listeners]) {
          try { void notify(event.data.providerId); }
          catch { /* A listener cannot alter durable denial state. */ }
        }
      };
    }
    return () => this.listeners.delete(listener);
  }

  audit(status, action, providerId) {
    this.omu?.record(status < 400 ? "Log" : "EHU",
      "PluginRPCRevocationStore", "RPC.DenialStore." + action,
      status, providerId);
  }

  open() {
    if (!this.indexedDB) {
      return Promise.reject(Error("IndexedDB unavailable"));
    }
    return new Promise((resolve, reject) => {
      const request = this.indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(Error("Database blocked"));
    });
  }

  async transaction(mode, action) {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        let output;
        const request = action(tx.objectStore(STORE));
        request.onsuccess = () => { output = request.result; };
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => resolve(output);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  async mark(providerId, scope) {
    const record = inspect(providerId, scope);
    if (!record) return failure(400, "INVALID_RPC_DENIAL");
    try {
      await this.transaction("readwrite", store => store.put(record));
      this.audit(201, "Persist", providerId);
      try {
        this.channel?.postMessage({ kind: "deny", providerId });
      } catch {
        // Broadcast is advisory; IndexedDB is the durable authority.
      }
      return { ok: true, status: 201 };
    } catch {
      this.audit(503, "PersistFailed", providerId);
      return failure(503, "RPC_DENIAL_STORAGE_UNAVAILABLE");
    }
  }

  /**
   * Only the trusted Host reapproval transaction may remove a
   * tombstone. Clearing a denial does not grant runtime permission.
   */
  async clear(providerId, scope) {
    const record = inspect(providerId, scope);
    if (!record) return failure(400, "INVALID_RPC_DENIAL");
    try {
      await this.transaction("readwrite", store =>
        store.delete(record.id));
      this.audit(200, "ClearAfterApproval", providerId);
      return { ok: true, status: 200 };
    } catch {
      this.audit(503, "ClearFailed", providerId);
      return failure(503, "RPC_DENIAL_STORAGE_UNAVAILABLE");
    }
  }

  async list(providerId) {
    if (typeof providerId !== "string" ||
        !PROVIDER.test(providerId)) {
      return failure(400, "INVALID_PROVIDER_ID");
    }
    try {
      const all = await this.transaction("readonly",
        store => store.getAll());
      if (!Array.isArray(all) || all.length > MAX_RECORDS) {
        throw Error("Denial store exceeds limit");
      }
      const scopes = [];
      for (const record of all) {
        const verified = inspect(record?.providerId, record?.scope);
        if (!verified || verified.id !== record.id) {
          throw Error("Corrupted denial record");
        }
        if (record.providerId === providerId) {
          scopes.push(verified.scope);
        }
      }
      const checked = Scopes.inspect(scopes);
      if (!checked.ok) throw Error("Invalid persisted scopes");
      return { ok: true, status: 200, value: checked.value };
    } catch {
      this.audit(503, "LoadFailed", providerId);
      return failure(503, "RPC_DENIAL_STORAGE_UNAVAILABLE");
    }
  }
}
