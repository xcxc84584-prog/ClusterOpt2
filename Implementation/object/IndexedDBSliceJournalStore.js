/**
 * IndexedDB-backed atomic checkpoint adapter. Each put/get/delete waits
 * for transaction completion; no sessionStorage fallback or disk write.
 */
export class IndexedDBSliceJournalStore {
  constructor(factory = globalThis.indexedDB) {
    this.factory = factory;
  }

  async withStore(mode, callback) {
    if (!this.factory) {
      const error = new Error("IndexedDB unavailable");
      error.status = 503;
      throw error;
    }
    const db = await new Promise((resolve, reject) => {
      const request = this.factory.open("clusteropt2-slice-journal", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("entries")) {
          request.result.createObjectStore("entries");
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
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

  put(entry) {
    return this.withStore("readwrite", store =>
      store.put(entry, entry.id));
  }

  delete(id) {
    return this.withStore("readwrite", store => store.delete(id));
  }
}
