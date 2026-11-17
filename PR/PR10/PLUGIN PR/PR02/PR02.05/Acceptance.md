# PR02.05 — Internal Catalog Query Acceptance
## Deliverables
- CatalogQuery.js: list(kind, page), describe(kind,id,owner), query(kind,filters,page).
- Bounded offset 0–4096 and page size 1–100, deterministic ordering.
- Ambiguous API IDs require owner (409); unknown IDs return 404.
- Invalid inputs return 400; no raw values, mutation, execution or public facade.
- Node and real Chromium tests, dedicated workflow.
## Security gate
PR02.05 is internal-only. PR02.06 MUST authorize and filter
visibility before exposing any discovery surface to plugins/users.
## Status
PASS at exact-head 8c7763c01b3c3c7cb22e258223776d03303e33bc.
Dedicated PR02 API Catalog, OCDA CI, PR1 OCDA Verification and
Local Agent PowerShell Parse all completed success.
Recovery: backup/plugin-pr02-sub05-8c7763c.
