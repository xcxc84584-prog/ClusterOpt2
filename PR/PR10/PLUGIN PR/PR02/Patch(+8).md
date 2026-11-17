# PLUGIN PR02 Patch(+8) — Automatic Documentation

Major PR 2 / Small PR 8 on plugin/pr02-api-catalog.

## Implementation
- CatalogDocumentation.js: immutable pure documentation policy.
- LinkCore.generateCatalogDocs(source,format,options) delegates all
  discovery to HubUnit.discoverCatalog, with its existing AccessPolicy.
- Supports JSON schemaVersion 1 and escaped Markdown output only.
- Per-format output capped to 64 KiB UTF-8; no truncated documents.
- Pulls authorized API and Property metadata in bounded pages.
- Does not read live property values, invoke Objects, touch files,
  inject DOM or publish browser-facing Cluster.docs.
- Separate global Property registration, global Property list updated.
- Node/Chromium tests and dedicated workflow updated.

## Corrective regression maintenance
Run 44025525379 failed one Node assertion: AgentAPI origin
was erroneously provided as a CatalogQuery filter rather than the
fifth options argument of LinkCore.discover. Corrected test only;
no expansion of query schema or authorization bypass.
All PR02.06/07/08 exact-head tests must PASS before checkpoints.

## Gate
Exact-head GitHub Actions, OCDA/PR1 Chromium and Windows pending.
No merge to main, no production version bump.
