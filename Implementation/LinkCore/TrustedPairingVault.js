/**
 * Host-only persistent pairing vault.
 *
 * The legacy Cluster checkbox is retained, but plaintext localStorage is
 * migrated into non-exportable AES-GCM credentials in same-origin IndexedDB.
 * The opaque-origin plugin iframe never receives tokens, ciphertext or keys.
 * Same-origin script compromise is still an elevated threat; user consent
 * is mandatory before saving a new pairing.
 */
const DB_NAME = "cluster-trusted-agent-pairing-v2";
const STORE = "vault";
const LEGACY_TOKEN = "cluster-terminal-remembered-token-v1";
const LEGACY_PORT = "cluster-terminal-remembered-port-v1";

function valid(value) {
  return Boolean(value &&
    /^[a-f0-9]{64}$/i.test(value.token) &&
    Number.isInteger(value.port) && value.port >= 1024 &&
    value.port <= 65535);
}

export class TrustedPairingVault {
  constructor(win) {
    this.win = win;
    this.database = null;
  }

  async open() {
    if (this.database) return this.database;
    const db = await new Promise((resolve, reject) => {
      const request = this.win.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    this.database = db;
    return db;
  }

  async request(mode, action) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const operation = action(transaction.objectStore(STORE));
      operation.onsuccess = () => resolve(operation.result);
      operation.onerror = () => reject(operation.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async get(key) {
    return this.request("readonly", store => store.get(key));
  }

  async put(key, value) {
    return this.request("readwrite", store => store.put(value, key));
  }

  async delete(key) {
    return this.request("readwrite", store => store.delete(key));
  }

  async encryptionKey() {
    let key = await this.get("key");
    if (!key) {
      key = await this.win.crypto.subtle.generateKey({
        name: "AES-GCM", length: 256
      }, false, ["encrypt", "decrypt"]);
      await this.put("key", key);
    }
    return key;
  }

  async save(value) {
    if (!valid(value)) throw Error("Invalid pairing credential");
    const key = await this.encryptionKey();
    const iv = this.win.crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(value));
    const encrypted = await this.win.crypto.subtle.encrypt({
      name: "AES-GCM", iv
    }, key, plain);
    await this.put("pair", {
      iv: Array.from(iv),
      payload: Array.from(new Uint8Array(encrypted))
    });
  }

  async load() {
    try {
      const key = await this.get("key");
      const stored = await this.get("pair");
      if (stored && key) {
        const bytes = await this.win.crypto.subtle.decrypt({
          name: "AES-GCM", iv: new Uint8Array(stored.iv)
        }, key, new Uint8Array(stored.payload));
        const candidate = JSON.parse(new TextDecoder().decode(bytes));
        return valid(candidate) ? candidate : null;
      }

      // One-time migration from the existing Cluster Remember checkbox.
      const storage = this.win.localStorage;
      const token = storage.getItem(LEGACY_TOKEN);
      const rawPort = storage.getItem(LEGACY_PORT);
      const port = rawPort === null ? 43881 : Number(rawPort);
      const legacy = { token, port };
      if (!valid(legacy)) return null;
      await this.save(legacy);
      storage.removeItem(LEGACY_TOKEN);
      storage.removeItem(LEGACY_PORT);
      return legacy;
    } catch {
      return null;
    }
  }

  async clear() {
    try {
      await this.delete("pair");
    } finally {
      try {
        this.win.localStorage.removeItem(LEGACY_TOKEN);
        this.win.localStorage.removeItem(LEGACY_PORT);
      } catch { /* Storage unavailable. */ }
    }
  }
}
