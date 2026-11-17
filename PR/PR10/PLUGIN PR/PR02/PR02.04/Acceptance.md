# PR02.04 — Live URU/EDPMU Catalog Collection

## Scope
- Internal, read-only CatalogCollection from current URU/EDPMU.
- One registry authority per kind; no duplicate mutable map or plugin execution.
- Frozen snapshots; exclude legacy Property entries with no descriptor.
- Dynamic Object add/remove and Property add/remove visible on next collection.
- Existing HubUnit authorization remains responsible for actual access.
- Bounded maximum 4096 registry entries; 413 on overflow.

## Verification
- Node: Implementation/tests/catalog-collection.test.js
- Browser: Implementation/e2e/plugin-pr02-catalog.spec.js
- Dedicated PR02 workflow and OCDA/Windows regression on exact commit.

Status: IMPLEMENTED — CI PENDING. Do not merge PR02 to main.
