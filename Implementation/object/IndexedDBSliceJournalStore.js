/**
 * IndexedDB-backed atomic checkpoint adapter. Each put/get/delete waits
 * for transaction completion; no sessionStorage fallback or disk write.
 */
export class IndexedDBSliceJournalStore {
  constructor(factory = globalThis.indexedDB) {
    this.factory = factory;
  }

  async openDatabase() {
    if (!this.factory) {
      const error = new Error("IndexedDB unavailable");
      error.status = 503;
      throw error;
    }
    return new Promise((resolve, reject) => {
      const request = this.factory.open("clusteropt2-slice-journal", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("entries")) {
          request.result.createObjectStore("entries");
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async withStore(mode, callback) {
    const db = await this.openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        let result;
        const tx = db.transaction("entries", mode);
        const request = callback(tx.objectStore("entries"));
        request.onsuccess = () => { result = request.result; };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (error) {
      if (error.status) throw error;
      const failure = new Error("Slice journal storage failure");
      failure.status = 503;
      throw failure;
    } finally {
      db.close();
    }
  }

  get(id) {
    return this.withStore("readonly", store => store.get(id));
  }

  /**
   * Atomic compare-and-store across tabs sharing the same database.
   * The revision check and put both run within one readwrite tx.
   */
  async putIfNewer(entry) {
    const db = await this.openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        let failure = null;
        const tx = db.transaction("entries", "readwrite");
        const store = tx.objectStore("entries");
        const get = store.get(entry.id);
        get.onsuccess = () => {
          if (get.result && entry.revision <= get.result.revision) {
            failure = new Error("Non-increasing journal revision");
            failure.status = 409;
            tx.abort();
            return;
          }
          store.put(entry, entry.id);
        };
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => {
          failure ??= tx.error;
        };
        tx.onabort = () => {
          const error = failure ?? new Error("Journal write aborted");
          if (!Number.isInteger(error.status)) error.status = 503;
          reject(error);
        };
      });
    } finally {
      db.close();
    }
  }

  delete(id) {
    return this.withStore("readwrite", store => store.delete(id));
  }
}
