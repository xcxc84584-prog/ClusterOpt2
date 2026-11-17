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
