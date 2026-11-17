# ClusterOpt2 PLUGIN PR03 Patch(+7) — Provider and Service Lifecycle Separation
## Scope
URU tracks disabled Providers and per-provider disabled Services separately from registration. HubUnit validates owning caller for enable/disable/dispose/unregister and records EHU/Log. Disable Provider disposes materialized instance while preserving Manifest, other Providers remain available. Unbind Route intentionally not implemented until PR04; draining/atomic switch in PR05.

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
