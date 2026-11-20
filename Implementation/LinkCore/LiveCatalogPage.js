import { CatalogVisibilityPolicy } from
  "../property/CatalogVisibilityPolicy.js";

/**
 * PR25 live, authorized catalog page. URU/EDPMU remain the only registries.
 * The page only materializes descriptor bodies for its selected records.
 * A cursor is bound to both the query and a live registry fingerprint.
 */
const MAX_LIMIT = 100;
const MAX_TERM = 128;
const NAME = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;

function fingerprint(parts) {
  // Deterministic change detector, NOT a security hash. The export
  // pipeline must calculate SHA-256 separately.
  let h = 2166136261;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      h ^= part.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 10;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function bad(status, error) {
  return { ok: false, status, error };
}

function encode(index, revision, query) {
  return [index, revision, query].join(":");
}

function decode(value, revision, query) {
  if (value === null || value === undefined) return 0;
  if (typeof value !== "string" || value.length > 256) return -1;
  const parts = value.split(":");
  if (parts.length !== 3 ||
      parts[1] !== revision || parts[2] !== query ||
      !/^(0|[1-9]\d*)$/.test(parts[0])) return -1;
  const index = Number(parts[0]);
  return Number.isSafeInteger(index) ? index : -1;
}

function summary(kind, id, owner, descriptor) {
  return Object.freeze({
    kind, id, owner,
    version: descriptor.version ?? null,
    audience: descriptor.audience ?? "HostInternal",
    visibility: descriptor.visibility,
    status: descriptor.deprecated ? "Deprecated" :
      (descriptor.unavailable ? "Unavailable" : "Available"),
    capability: descriptor.permissions ?? [],
    description: descriptor.description ?? ""
  });
}

export class LiveCatalogPage {
  constructor(uru, edpmu, omu) {
    this.uru = uru;
    this.edpmu = edpmu;
    this.omu = omu;
  }

  /**
   * Scan lightweight registered metadata for the filtered page.
   * Descriptors are returned only by describe(), never by page().
   * No copy of the complete public descriptor catalog is retained.
   */
  page(source, kind = "api", options = {}) {
    if (!this.uru.objects.has(source)) {
      return bad(404, "Unknown caller");
    }
    const { term = "", owner = "", limit = 50,
      cursor = null, origin = "user" } = options;
    if (!["api", "service", "property", "event", "protocol"]
          .includes(kind) ||
        !["user", "agent"].includes(origin) ||
        typeof term !== "string" || term.length > MAX_TERM ||
        typeof owner !== "string" ||
        (owner !== "" && (!NAME.test(owner) || owner.length > 128)) ||
        !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return bad(400, "Invalid catalog page request");
    }
    const needle = term.toLowerCase();
    const query = fingerprint([kind, source, origin, owner, needle,
      String(limit)]);
    const entries = [];
    const revisionParts = [];

    if (kind === "api" || kind === "event") {
      for (const [objectId, object] of this.uru.objects) {
        // The URU metadata is live. Never infer missing schemas.
        const descriptors = object.ocda?.APIDescriptors;
        if (!Array.isArray(descriptors)) continue;
        for (const descriptor of descriptors) {
          revisionParts.push(JSON.stringify([
            objectId, descriptor, object.authorization,
            object.ocda?.UserAPI, object.ocda?.AgentAPI
          ]));
          if ((descriptor.category === "Event") !==
              (kind === "event")) continue;
          const entry = { owner: objectId, descriptor };
          if (!CatalogVisibilityPolicy.canSeeAPI(
            source, entry, object, origin)) continue;
          if (owner && objectId !== owner) continue;
          if (needle && ![descriptor.id, descriptor.description ?? ""]
            .some(value => value.toLowerCase().includes(needle))) continue;
          entries.push({
            id: descriptor.id, owner: objectId, descriptor
          });
        }
      }
    } else if (kind === "service") {
      for (const provider of this.uru.providers.values()) {
        const serviceObject = this.uru.objects.get(provider.objectId);
        if (!serviceObject) continue;
        for (const action of provider.provides) {
          const serviceEntry = {
            owner: provider.objectId,
            descriptor: { action: action.action }
          };
          if (!CatalogVisibilityPolicy.canSeeAPI(source,
            serviceEntry, serviceObject, origin)) continue;
          const unavailable = this.uru.disabledProviders.has(
            provider.providerId) ||
            !this.uru.isServiceEnabled(provider.providerId,
              action.service);
          const descriptor = {
            id: action.service, version: action.version,
            action: action.action, visibility: "Public",
            permissions: provider.permissions,
            audience: "PluginPublic",
            inputSchema: action.inputSchema,
            outputSchema: action.outputSchema,
            unavailable
          };
          revisionParts.push(JSON.stringify([
            provider.providerId, provider.objectId, descriptor,
            serviceObject.authorization, serviceObject.ocda?.UserAPI,
            serviceObject.ocda?.AgentAPI
          ]));
          if (owner && owner !== provider.objectId) continue;
          if (needle && ![descriptor.id, descriptor.action]
            .some(value => value.toLowerCase().includes(needle))) continue;
          entries.push({
            id: descriptor.id, owner: provider.objectId, descriptor
          });
        }
      }
    } else if (kind === "protocol") {
      const policy = this.edpmu.get("HubProtocolPolicy");
      const definition = this.edpmu.describe("HubProtocolPolicy");
      if (definition?.visibility === "Public" && policy?.descriptions) {
        for (const descriptor of policy.descriptions) {
          revisionParts.push(JSON.stringify(descriptor));
          if (owner && owner !== "HubUnit") continue;
          if (needle && ![descriptor.id, descriptor.description ?? ""]
            .some(value => value.toLowerCase().includes(needle))) continue;
          entries.push({ id: descriptor.id, owner: "HubUnit",
            descriptor: { ...descriptor, visibility: "Public" } });
        }
      }
    } else {
      for (const record of this.edpmu.list()) {
        const definition = this.edpmu.describe(record.name);
        const described = this.edpmu.describeProperty(record.name);
        const descriptor = described.ok ? described.value : null;
        if (descriptor === null || !descriptor) continue;
        revisionParts.push(JSON.stringify([
          record.name, descriptor, definition
        ]));
        const entry = { name: record.name, descriptor };
        if (!CatalogVisibilityPolicy.canSeeProperty(
          source, entry, definition)) {
          // The property authorization is evaluated with the same
          // EDPMU definition object as the legacy catalog projection.
          continue;
        }
        if (owner && !descriptor.owners.includes(owner)) continue;
        if (needle && ![record.name, descriptor.description ?? ""]
          .some(value => value.toLowerCase().includes(needle))) continue;
        entries.push({
          id: record.name, owner: descriptor.owners.join(","),
          descriptor
        });
      }
    }
    entries.sort((a, b) => a.owner.localeCompare(b.owner) ||
      a.id.localeCompare(b.id));
    const revision = fingerprint(revisionParts.sort());
    const index = decode(cursor, revision, query);
    if (index < 0) {
      const result = bad(409, "Catalog revision or cursor changed");
      this.omu?.record("EHU", source, "Catalog.RevisionMismatch",
        409, kind, { code: "CATALOG_REVISION_MISMATCH",
          snapshotRevision: revision });
      return result;
    }
    const items = entries.slice(index, index + limit)
      .map(item => summary(kind, item.id, item.owner, item.descriptor));
    const next = index + limit < entries.length ?
      encode(index + limit, revision, query) : null;
    return {
      ok: true, status: 200,
      value: {
        items, total: entries.length, nextCursor: next,
        snapshotRevision: revision
      }
    };
  }

  describe(source, kind, id, owner = null, origin = "user") {
    if (typeof id !== "string" || !NAME.test(id) ||
        (owner !== null && (typeof owner !== "string" ||
          !NAME.test(owner)))) return bad(400, "Invalid API selector");
    if (!this.uru.objects.has(source)) return bad(404, "Unknown caller");
    if (kind === "api" || kind === "event") {
      const found = [];
      for (const [objectId, object] of this.uru.objects) {
        if (owner && owner !== objectId) continue;
        const descriptor = object.ocda?.APIDescriptors
          ?.find(item => item.id === id);
        if (!descriptor ||
            (descriptor.category === "Event") !==
              (kind === "event")) continue;
        const entry = { owner: objectId, descriptor };
        if (CatalogVisibilityPolicy.canSeeAPI(
          source, entry, object, origin)) found.push(entry);
      }
      if (found.length > 1) return bad(409, "Ambiguous API ID");
      if (!found.length) return bad(404, "Descriptor not found");
      return { ok: true, status: 200, value: found[0] };
    }
    if (kind === "property") {
      const defined = this.edpmu.describe(id);
      const described = this.edpmu.describeProperty(id);
      if (!described.ok || !described.value ||
          !CatalogVisibilityPolicy.canSeeProperty(source,
            { name: id, descriptor: described.value }, defined)) {
        return bad(404, "Descriptor not found");
      }
      return { ok: true, status: 200,
        value: { name: id, descriptor: described.value } };
    }
    if (kind === "service") {
      const found = [];
      for (const provider of this.uru.providers.values()) {
        const serviceObject = this.uru.objects.get(provider.objectId);
        if (!serviceObject ||
            (owner && provider.objectId !== owner)) continue;
        for (const action of provider.provides) {
          if (!CatalogVisibilityPolicy.canSeeAPI(source, {
            owner: provider.objectId,
            descriptor: { action: action.action }
          }, serviceObject, origin)) continue;
          if (action.service === id) found.push({
            owner: provider.objectId, providerId: provider.providerId,
            descriptor: {
              ...action, id: action.service, visibility: "Public",
              audience: "PluginPublic", permissions: provider.permissions
            }
          });
        }
      }
      if (found.length > 1) return bad(409, "Ambiguous Service ID");
      return found.length ? { ok: true, status: 200, value: found[0] } :
        bad(404, "Descriptor not found");
    }
    if (kind === "protocol") {
      const definition = this.edpmu.describe("HubProtocolPolicy");
      const descriptors = this.edpmu.get("HubProtocolPolicy")?.descriptions;
      if (definition?.visibility !== "Public") {
        return bad(404, "Descriptor not found");
      }
      const descriptor = descriptors?.find(x => x.id === id);
      return descriptor ? { ok: true, status: 200,
        value: { owner: "HubUnit", descriptor } } :
        bad(404, "Descriptor not found");
    }
    return bad(400, "Unsupported descriptor kind");
  }
}
