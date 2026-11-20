/**
 * Trusted PR25 static catalog guard. A manually maintained contract must
 * declare a version and source file location; never invent source lines.
 * No client can grant access or mutate URU through this helper.
 */
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./()+-]+$/;

export class CatalogStaticGuard {
  constructor(uru, omu) {
    this.uru = uru;
    this.omu = omu;
  }

  verify(manifest) {
    if (!Array.isArray(manifest) || manifest.length > 10000) {
      return { ok: false, status: 400,
        error: "Invalid static catalog manifest" };
    }
    const failures = [];
    const seen = new Set();
    for (const record of manifest) {
      const { owner, id, version, file, line } = record ?? {};
      if (typeof owner !== "string" || !owner ||
          typeof id !== "string" || !id ||
          typeof version !== "string" || !VERSION.test(version) ||
          typeof file !== "string" || !PATH.test(file) ||
          !Number.isSafeInteger(line) || line < 1) {
        failures.push({ code: "CATALOG_STATIC_INVALID",
          owner, id, file: typeof file === "string" ? file : null,
          line: Number.isSafeInteger(line) ? line : null });
        continue;
      }
      const key = owner + "\u0000" + id;
      if (seen.has(key)) {
        failures.push({ code: "CATALOG_STATIC_DUPLICATE",
          owner, id, file, line });
        continue;
      }
      seen.add(key);
      const object = this.uru.objects.get(owner);
      const descriptor = object?.ocda?.APIDescriptors
        ?.find(entry => entry.id === id);
      if (!descriptor || descriptor.version !== version) {
        failures.push({
          code: descriptor ? "CATALOG_VERSION_MISMATCH" :
            "CATALOG_SOURCE_NOT_REGISTERED",
          owner, id, file, line,
          expectedVersion: version,
          actualVersion: descriptor?.version ?? null
        });
      }
    }
    for (const failure of failures) {
      this.omu.record("EHU", "LinkCore", "Catalog.StaticConsistency",
        409, failure.owner ?? "", failure);
    }
    return failures.length ?
      { ok: false, status: 409, failures } :
      { ok: true, status: 200, checked: manifest.length };
  }
}
