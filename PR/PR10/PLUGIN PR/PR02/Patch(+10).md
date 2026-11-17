# PLUGIN PR02 Patch(+10) — Browser read-only Catalog Facade

## Scope
Major PR 02 / Small PR 10 of PR10 PLUGIN PR sequence.
A separate ClusterAPIFacade.js exposes four metadata-only methods:
`Cluster.api.list(kind, page)`,
`Cluster.api.describe(kind, id, owner)`,
`Cluster.api.query(kind, filter, page)`,
`Cluster.api.docs(format)`.

## Implementation
- New immutable browser-facing facade; fixed trusted caller `ui`
  and origin `user` (input cannot impersonate other Object or Agent).
- Delegate every metadata query to existing LinkCore -> HubUnit
  -> AuthorizedCatalogCollection -> CatalogQuery. Docs use the existing
  bounded CatalogDocumentation and record rendering EHU through LinkCore.
- Existing Cluster legacy methods, central version, Request/Response,
  real editor, save, journal, and recovery unchanged.
- Add Node facade tests and real Chromium E2E; update prior negative
  test from "facade undefined" to "facade object".

## GitHub upstream research
- https://github.com/Microsoft/vscode/wiki/Extension-API-process
- https://code.visualstudio.com/api/extension-capabilities/overview
- https://github.com/microsoft/monaco-editor
Public extensions APIs should be explicit, stable and narrower than
internal implementations. The Catalog describes capabilities; it never
grants runtime permissions or executes a plugin.

## Security, cost, rollback
- Metadata only, no arbitrary file handles, keys, code execution,
  registry mutation or new origin/permission authority.
- Existing per-query 4096-item/100-page and document 64KiB bounds apply.
- Pre-subPR09 backup: backup/plugin-pr02-sub09-2cc7f47 at 2cc7f476.
- PR02 remains Draft until exact-head Node, Chromium, OCDA, PR1 and
  Windows validation and a PR02 rollback point exist.
