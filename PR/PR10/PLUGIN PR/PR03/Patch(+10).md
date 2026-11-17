# ClusterOpt2 PLUGIN PR03 Patch(+10) — Cross-Object Integration and Release Governance
## Scope
Node tests exercise URU cleanup, EDPMU ACL, multi-Provider, factory laziness, disable and dispose, compatibility, health, real VTE 00/10/01 relation code; Chromium tests live editor page and legacy Cluster API. ReleaseVersion.js is canonical product version, package.json CI-checked mirror; scripts/sync-release.mjs syncs only at major release, PR remains Draft until all exact-head CI and restore points verified.

## OCDA / Evidence
Reviewed current URU/EDPMU/HubUnit/OMU internals and upstream design:
- VS Code: https://github.com/microsoft/vscode/blob/main/src/vs/platform/extensions/common/extensions.ts
- Theia: https://github.com/eclipse-theia/theia/blob/master/packages/plugin-ext/src/common/plugin-protocol.ts
- AsyncAPI: https://github.com/asyncapi/spec/blob/master/spec/asyncapi.md

PRD → Plan → ArcD → Implementation + Relation Test → Project.
Changes reside in separate LinkCore/Property files; no direct File I/O,
no new independent Object authority, no shell commands or injected code.
No API Catalog permission expansion. Negative statuses must create EHU.
Current code is subject to exact-head Node/Chromium/OCDA/Windows gates.
Sub-PR cannot be labeled PASS until tests and checkpoint verification.

## Final hardening after initial integration
- URU Provider registration now checks EDPMU claims even if called
  directly by trusted core, blocks cross-Provider cyclic dependencies
  before any index change, and has a 4096-Provider capacity ceiling.
- Global Service DAG uses iterative Kahn topological check rather than
  recursive DFS; fails atomically with 409 and OMU EHU via HubUnit.
- Relation Test explicitly exercises 00, 10, 01, 11 and rejects
  cycles without orphan Service entries.
- ReleaseVersion is non-writable in LinkCore; EDPMU supports readOnly
  definitions and SystemVersion/new policy definitions are readOnly.
- scripts/sync-release.mjs supports --check/--write; package.json
  runs version:check in every npm run check.
- .github/workflows/unified-release.yml requires manual dispatch on
  main, channel stable, Node and browser checks before GitHub Release.
  It is NOT triggered automatically for Draft child PRs.
- Latest exact-head CI still required before declaring PR03 PASS.
