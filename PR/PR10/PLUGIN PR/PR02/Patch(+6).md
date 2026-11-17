# PLUGIN PR02 Patch(+6) — Catalog Visibility Projection
Major PR 2 / Small PR 6, development branch plugin/pr02-api-catalog.

Added:
- Independent Property CatalogVisibilityPolicy.js registered by LinkCore.
- AuthorizedCatalogCollection.js: source-scoped, no persistent index.
- HubUnit.discoverCatalog and LinkCore.discover, for trusted callers only.
- Node and Chromium permission tests, dedicated CI hooks.
- Full global Property index and PRD/Plan/ArcD/Relation Test updates.

Behavior:
- Registered caller required, no implicit object factory.
- Actual UserAPI/AgentAPI + AccessPolicy + EDPMU metadata read constraints.
- Filter before search, count and pagination. Invisible looks like 404.
- EHU on invalid/absent discovery, Log on success.
- No execution capability from metadata, no public window.Cluster.api.
- No changes to legacy Editor/Save/Recovery or production version.

CI state: PENDING exact-head Node/Chromium/OCDA/Windows.
PR02.05 CI pending previous submission; do not claim PASS prematurely.
Recovery: backup/plugin-pr02-sub04-79c5633, main protected.

## CI repair (+6.1)
Dedicated workflow 44025082253 failed Node + Chromium due to legacy
non-OCDA caller being treated as strict self-described Object.
Fixed CatalogCollection to bypass such metadata-only enumeration,
without changing URU runtime registration, Hub request permissions or
legacy functionality. Added new legacy collection regression test.
Await exact-head confirmation.
