import { LiveCatalogPage } from "./LiveCatalogPage.js";

/**
 * Authorized complete export. Unlike page(), export is deliberately an
 * all-record operation and is bounded by serialized byte size.
 */
const MAX_EXPORT_BYTES = 64 * 1024 * 1024;
const KINDS = ["api", "service", "property", "event", "protocol"];

export class LiveCatalogExport {
  constructor(uru, edpmu, omu) {
    this.page = new LiveCatalogPage(uru, edpmu, omu);
    this.uru = uru;
    this.edpmu = edpmu;
    this.omu = omu;
  }

  async export(source, origin = "user") {
    const result = Object.fromEntries(KINDS.map(kind => [kind, []]));
    const revisions = {};
    for (const kind of KINDS) {
      let cursor = null;
      do {
        const response = this.page.page(source, kind, {
          limit: 100, cursor, origin
        });
        if (!response.ok) return response;
        revisions[kind] ??= response.value.snapshotRevision;
        if (revisions[kind] !== response.value.snapshotRevision) {
          return { ok: false, status: 409,
            error: "Catalog changed during export" };
        }
        for (const item of response.value.items) {
          let descriptor;
          if (kind === "api" || kind === "event") {
            descriptor = this.uru.objects.get(item.owner)?.ocda
              ?.APIDescriptors?.find(x => x.id === item.id &&
                (x.category === "Event") === (kind === "event"));
          } else if (kind === "property") {
            descriptor = this.edpmu.describeProperty(item.id).value;
          } else if (kind === "protocol") {
            descriptor = this.edpmu.get("HubProtocolPolicy")
              ?.descriptions?.find(x => x.id === item.id);
          } else if (kind === "service") {
            for (const provider of this.uru.providers.values()) {
              if (provider.objectId !== item.owner) continue;
              const action = provider.provides.find(
                x => x.service === item.id);
              if (action) {
                descriptor = { ...action, id: item.id,
                  visibility: "Public", audience: "PluginPublic",
                  permissions: provider.permissions,
                  providerId: provider.providerId };
                break;
              }
            }
          }
          if (!descriptor) {
            this.omu?.record("EHU", source, "Catalog.ExportStale",
              409, item.id, { code: "CATALOG_EXPORT_STALE" });
            return { ok: false, status: 409,
              error: "Catalog changed during export" };
          }
          result[kind].push({ id: item.id, owner: item.owner,
            descriptor });
        }
        cursor = response.value.nextCursor;
      } while (cursor);
    }
    // Detect any registration or contract mutation during construction.
    for (const kind of ["api", "property"]) {
      const check = this.page.page(source, kind, { limit: 1, origin });
      if (!check.ok ||
          check.value.snapshotRevision !== revisions[kind]) {
        this.omu?.record("EHU", source, "Catalog.ExportStale",
          409, kind, { code: "CATALOG_EXPORT_REVISION_MISMATCH" });
        return { ok: false, status: 409,
          error: "Catalog revision changed during export" };
      }
    }
    const payload = {
      schemaVersion: 1, snapshotRevision: revisions,
      counts: Object.fromEntries(KINDS.map(kind =>
        [kind, result[kind].length])),
      contracts: result
    };
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    if (bytes.byteLength > MAX_EXPORT_BYTES) {
      return { ok: false, status: 413, error: "Export too large" };
    }
    if (!globalThis.crypto?.subtle) {
      return { ok: false, status: 503, error: "SHA-256 unavailable" };
    }
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    // Final revision check after SHA computation; no partial downloads.
    for (const kind of ["api", "property"]) {
      const check = this.page.page(source, kind, { limit: 1, origin });
      if (!check.ok ||
          check.value.snapshotRevision !== revisions[kind]) {
        this.omu?.record("EHU", source, "Catalog.ExportStale",
          409, kind, { code: "CATALOG_EXPORT_REVISION_MISMATCH" });
        return { ok: false, status: 409,
          error: "Catalog revision changed during export" };
      }
    }
    return {
      ok: true, status: 200,
      value: {
        json, byteLength: bytes.byteLength,
        sha256: Array.from(new Uint8Array(digest),
          byte => byte.toString(16).padStart(2, "0")).join(""),
        snapshotRevision: revisions,
        counts: payload.counts
      }
    };
  }
}
