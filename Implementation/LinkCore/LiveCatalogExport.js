import { LiveCatalogPage } from "./LiveCatalogPage.js";

/**
 * Complete, authorized export with a consistent live registry snapshot.
 * Every descriptor is fetched through the same ACL path as describeLive.
 * Never read registry internals directly or release a partial artifact.
 */
const MAX_EXPORT_BYTES = 64 * 1024 * 1024;
const KINDS = Object.freeze([
  "api", "service", "property", "event", "protocol"
]);

function fail(omu, source, code, kind, status = 409) {
  omu?.record("EHU", source, "Catalog.ExportConsistency",
    status, kind, { code });
  return { ok: false, status, error: code };
}

export class LiveCatalogExport {
  constructor(uru, edpmu, omu) {
    this.page = new LiveCatalogPage(uru, edpmu, omu);
    this.omu = omu;
  }

  async export(source, origin = "user") {
    const contracts = Object.fromEntries(
      KINDS.map(kind => [kind, []]));
    const revisions = {};
    const expectedTotals = {};

    for (const kind of KINDS) {
      let cursor = null;
      do {
        const response = this.page.page(source, kind, {
          cursor, limit: 100, origin
        });
        if (!response.ok) return response;
        const { items, total, nextCursor, snapshotRevision } =
          response.value;
        revisions[kind] ??= snapshotRevision;
        expectedTotals[kind] ??= total;
        if (revisions[kind] !== snapshotRevision ||
            expectedTotals[kind] !== total) {
          return fail(this.omu, source,
            "CATALOG_EXPORT_REVISION_MISMATCH", kind);
        }
        for (const item of items) {
          const owner = ["api", "service", "event"].includes(kind) ?
            item.owner : null;
          const detail = this.page.describe(
            source, kind, item.id, owner, origin);
          if (!detail.ok) {
            return fail(this.omu, source,
              "CATALOG_EXPORT_DESCRIPTOR_STALE", kind);
          }
          contracts[kind].push({
            id: item.id, owner: item.owner,
            descriptor: detail.value.descriptor
          });
        }
        cursor = nextCursor;
      } while (cursor);

      if (contracts[kind].length !== expectedTotals[kind]) {
        return fail(this.omu, source,
          "CATALOG_EXPORT_COUNT_MISMATCH", kind);
      }
    }

    const consistent = () => KINDS.every(kind => {
      const current = this.page.page(source, kind, {
        limit: 1, origin
      });
      return current.ok &&
        current.value.snapshotRevision === revisions[kind] &&
        current.value.total === expectedTotals[kind];
    });
    if (!consistent()) {
      return fail(this.omu, source,
        "CATALOG_EXPORT_REVISION_MISMATCH", "all");
    }

    const counts = Object.fromEntries(
      KINDS.map(kind => [kind, contracts[kind].length]));
    const payload = {
      schemaVersion: 1,
      snapshotRevision: revisions,
      counts,
      contracts
    };
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    if (bytes.byteLength > MAX_EXPORT_BYTES) {
      return fail(this.omu, source,
        "CATALOG_EXPORT_TOO_LARGE", "all", 413);
    }
    if (!globalThis.crypto?.subtle) {
      return fail(this.omu, source,
        "CATALOG_EXPORT_SHA256_UNAVAILABLE", "all", 503);
    }
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256", bytes);

    // A suspension, withdrawal or registration change during hashing
    // invalidates the entire export, not just its affected category.
    if (!consistent()) {
      return fail(this.omu, source,
        "CATALOG_EXPORT_REVISION_MISMATCH", "all");
    }
    return {
      ok: true, status: 200,
      value: {
        json,
        counts,
        snapshotRevision: revisions,
        byteLength: bytes.byteLength,
        sha256: Array.from(new Uint8Array(digest),
          byte => byte.toString(16).padStart(2, "0")).join("")
      }
    };
  }
}
