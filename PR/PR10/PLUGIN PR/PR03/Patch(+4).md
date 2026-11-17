# ClusterOpt2 PLUGIN PR03 Patch(+4) — EDPMU Shared Property Claims
## Scope
Manifest optional bounded sharedProperties {name,access,isolation}; validate before use. ProviderSharedPropertyPolicy consults authoritative EDPMU owners/visibility and refuses undeclared writes. HubUnit.publishProviderProperty enforces source, Provider owner, claim and EDPMU. EHU rejects 403. No direct plugin Property overwrite.

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
