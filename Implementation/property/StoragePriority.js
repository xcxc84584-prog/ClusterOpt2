/**
 * Shared storage conflict preference.
 * InternalFirst is a safe default until user explicitly changes it.
 */
export const StoragePriority = Object.freeze({
  EXTERNAL: "external",
  INTERNAL: "internal",
  defaultValue: "internal",
  storageKey: "clusteropt2.storagePriority.v1",
  valid(value) {
    return value === this.EXTERNAL || value === this.INTERNAL;
  }
});
