import { PluginFolderPackageUnit } from
  "./PluginFolderPackageUnit.js";

/**
 * PR13.8: persistent package bytes, NOT a runtime Provider registry.
 * Loading stored bytes cannot activate code or restore authorization.
 */
const DB_NAME = "clusteropt2-plugin-packages";
const STORE = "packages";
const VERSION = 1;

function fail(status, error) {
  return { ok: false, status, error };
}

export class PluginPackageStoreUnit {
  constructor(omu, indexedDB = globalThis.indexedDB) {
    this.omu = omu;
    this.indexedDB = indexedDB;
    this.reader = new PluginFolderPackageUnit(omu);
  }

  record(status, action) {
    this.omu?.record(status < 400 ? "Log" : "EHU",
      "PluginPackageStore", "Plugin.Package." + action, status);
  }

  open() {
    if (!this.indexedDB) return Promise.reject(Error("Storage unavailable"));
    return new Promise((resolve, reject) => {
      const request = this.indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "providerId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async transaction(mode, operation) {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        let result;
        const request = operation(store);
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  async save(snapshot) {
    const checked = this.reader.inspectImport(snapshot);
    if (!checked.ok) return checked;
    const id = JSON.parse(snapshot.manifestText).provider.providerId;
    try {
      await this.transaction("readwrite", store =>
        store.put({ providerId: id, snapshot,
          enabled: false, approved: false }));
      this.record(201, "Persist");
      return { ok: true, status: 201, providerId: id };
    } catch {
      this.record(503, "Persist");
      return fail(503, "Package storage unavailable");
    }
  }

  async list() {
    try {
      const records = await this.transaction("readonly",
        store => store.getAll());
      const packages = [];
      for (const record of records) {
        const checked = this.reader.inspectImport(record.snapshot);
        if (checked.ok) {
          packages.push({
            providerId: record.providerId, snapshot: record.snapshot,
            enabled: false, approved: false
          });
        } else {
          this.record(400, "RestoreReject");
        }
      }
      this.record(200, "List");
      return { ok: true, status: 200, value: packages };
    } catch {
      this.record(503, "List");
      return fail(503, "Package storage unavailable");
    }
  }

  async remove(providerId) {
    if (typeof providerId !== "string" || !providerId) {
      return fail(400, "Invalid provider ID");
    }
    try {
      await this.transaction("readwrite",
        store => store.delete(providerId));
      this.record(200, "Remove");
      return { ok: true, status: 200 };
    } catch {
      this.record(503, "Remove");
      return fail(503, "Package storage unavailable");
    }
  }
}
