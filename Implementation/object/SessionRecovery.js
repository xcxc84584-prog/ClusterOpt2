import { RecoveryPolicy } from "../property/RecoveryPolicy.js";

/**
 * A single IndexedDB snapshot for tabs, directory roots and viewport.
 * Each operation runs through HubUnit for EHU, Log and dependency tracking.
 */
export class SessionRecovery {
  constructor(core, factory = globalThis.indexedDB) {
    this.id = "session-recovery";
    this.core = core;
    this.factory = factory;
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    this.ocda = Object.freeze({
      Request: ["persist", "restore"],
      Response: ["persist", "restore"],
      UserAPI: ["persist", "restore"], AgentAPI: [],
      Property: ["RecoveryPolicy"],
      Program: "SessionRecovery", EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
    if (!core.register(this)) throw new Error("Recovery registration failed");
  }

  open() {
    if (!this.factory) {
      const error = new Error("IndexedDB unavailable");
      error.status = 503;
      return Promise.reject(error);
    }
    return new Promise((resolve, reject) => {
      const req = this.factory.open("clusteropt2-session", 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("snapshots")) {
          req.result.createObjectStore("snapshots");
        }
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  async transact(mode, value) {
    const database = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = database.transaction("snapshots",
          mode === "read" ? "readonly" : "readwrite");
        const request = mode === "read" ?
          tx.objectStore("snapshots").get("current") :
          tx.objectStore("snapshots").put(value, "current");
        let result;
        request.onsuccess = () => { result = request.result; };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      database.close();
    }
  }

  async call(target, action, payload = {}) {
    const result = await this.core.request(this.id, target, action, payload);
    if (!result.ok) {
      const error = new Error(result.error);
      error.status = result.status;
      throw error;
    }
    return result.value;
  }

  async receive(action) {
    if (action === "persist") {
      const documents = await this.call("workspace", "snapshot");
      const roots = await this.call("explorer", "snapshotRoots");
      const snapshot = {
        schema: RecoveryPolicy.schema, documents: documents.documents,
        activeId: documents.activeId, roots
      };
      if (!RecoveryPolicy.isSnapshot(snapshot)) {
        const error = new RangeError("Invalid or oversized recovery data");
        error.status = 413;
        throw error;
      }
      await this.transact("write", snapshot);
      // A second text-only recovery channel survives session navigation
      // even when a browser cannot reopen structured-cloned handles.
      try {
        const fallback = {
          ...snapshot,
          roots: [],
          documents: snapshot.documents.map(document => ({
            ...document, handle: null
          }))
        };
        globalThis.sessionStorage?.setItem(
          "clusteropt2.recovery.fallback", JSON.stringify(fallback));
      } catch (error) {
        this.core.omu.record("EHU", this.id, "Fallback.Persist",
          503, "sessionStorage", { error: String(error) });
      }
      return true;
    }
    if (action === "restore") {
      let snapshot = null;
      try {
        snapshot = await this.transact("read");
      } catch (error) {
        this.core.omu.record("EHU", this.id, "Database.Restore",
          503, "IndexedDB", { error: String(error) });
      }
      if (!snapshot) {
        try {
          const text = globalThis.sessionStorage?.getItem(
            "clusteropt2.recovery.fallback");
          snapshot = text ? JSON.parse(text) : null;
        } catch (error) {
          this.core.omu.record("EHU", this.id, "Fallback.Restore",
            503, "sessionStorage", { error: String(error) });
        }
      }
      if (!snapshot) return false;
      if (!RecoveryPolicy.isSnapshot(snapshot)) {
        const error = new Error("Unsupported recovery snapshot");
        error.status = 400;
        throw error;
      }
      await this.call("workspace", "restore", { snapshot });
      await this.call("explorer", "restoreRoots", {
        roots: snapshot.roots
      });
      return true;
    }
    const error = new TypeError("Unknown recovery action");
    error.status = 400;
    throw error;
  }
}
