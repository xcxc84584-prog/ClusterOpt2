# PLUGIN PR02 Patch(+4) — Live Catalog Collection
Major PR 2 / Small PR 4.

New: Implementation/LinkCore/CatalogCollection.js, live URU/EDPMU
read-only projection, bounded 4096 entries, frozen sorted descriptors.
Changed: LinkCore internal catalog member; dedicated GitHub Actions
Node and Chromium tests. Added independent unit/e2e cases.
No new shared Property or public Cluster facade. No plugin execution,
privilege escalation, actual file write or production version bump.
Rollback: backup/plugin-pr02-sub03-da2672e; PR02 remains draft.
CI: pending exact-head run.
