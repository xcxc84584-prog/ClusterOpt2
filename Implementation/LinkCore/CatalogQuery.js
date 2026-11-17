/**
 * Pure, bounded read-only discovery over CatalogCollection snapshots.
 * Internal-only until HubUnit caller authorization is added in PR02.06.
 */
const KINDS = new Set(["api", "property"]);
const MATCH = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;
const MAX_PAGE = 100;
const MAX_INDEX = 4096;

function validName(value) {
  return typeof value === "string" && value.length <= 128 &&
    MATCH.test(value) && !["__proto__", "constructor", "prototype"].includes(value);
}

function validPage(options) {
  return options && typeof options === "object" &&
    !Array.isArray(options) &&
    Number.isSafeInteger(options.offset ?? 0) &&
    (options.offset ?? 0) >= 0 && (options.offset ?? 0) <= MAX_INDEX &&
    Number.isSafeInteger(options.limit ?? 50) &&
    (options.limit ?? 50) >= 1 && (options.limit ?? 50) <= MAX_PAGE;
}

function error(status, code) {
  return Object.freeze({ ok: false, status, error: code });
}

/** A query uses one immutable snapshot to avoid cross-page mutation races. */
export class CatalogQuery {
  constructor(collection) {
    this.collection = collection;
  }

  list(kind, options = {}) {
    return this.query(kind, {}, options);
  }

  describe(kind, id, owner = null) {
    if (!KINDS.has(kind) || !validName(id) ||
        (owner !== null && !validName(owner))) {
      return error(400, "Invalid catalog selector");
    }
    const snapshot = this.collection.collect();
    if (!snapshot.ok) return snapshot;
    const entries = kind === "api" ?
      snapshot.value.apis : snapshot.value.properties;
    const matches = entries.filter(item => kind === "api" ?
      item.descriptor.id === id &&
        (owner === null || item.owner === owner) :
      item.name === id);
    if (!matches.length) return error(404, "Descriptor not found");
    if (matches.length > 1) {
      return error(409, "Ambiguous API ID; specify owner");
    }
    return Object.freeze({ ok: true, status: 200, value: matches[0] });
  }

  query(kind, filters = {}, options = {}) {
    if (!KINDS.has(kind) || !filters ||
        typeof filters !== "object" || Array.isArray(filters) ||
        Object.keys(filters).some(key =>
          !["owner", "term"].includes(key)) || !validPage(options)) {
      return error(400, "Invalid catalog query");
    }
    if (filters.owner !== undefined && !validName(filters.owner)) {
      return error(400, "Invalid catalog owner");
    }
    if (filters.term !== undefined &&
        (typeof filters.term !== "string" ||
         filters.term.length > 128)) {
      return error(400, "Invalid catalog search term");
    }
    const snapshot = this.collection.collect();
    if (!snapshot.ok) return snapshot;
    const entries = kind === "api" ?
      snapshot.value.apis : snapshot.value.properties;
    const term = (filters.term ?? "").toLowerCase();
    const filtered = entries.filter(item => {
      const descriptor = item.descriptor;
      const name = kind === "api" ? descriptor.id : item.name;
      const ownerMatches = filters.owner === undefined ||
        (kind === "api" ? item.owner === filters.owner :
          descriptor.owners.includes(filters.owner));
      return ownerMatches &&
        (term === "" || name.toLowerCase().includes(term) ||
          (descriptor.description ?? "").toLowerCase().includes(term));
    });
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    const total = filtered.length;
    const nextOffset = offset + limit < total ? offset + limit : null;
    return Object.freeze({
      ok: true, status: 200,
      value: Object.freeze({
        items: Object.freeze(filtered.slice(offset, offset + limit)),
        total, offset, limit, nextOffset
      })
    });
  }
}
