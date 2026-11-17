# ClusterOpt2 PLUGIN PR03 Patch(+9) — Provider Health State and Cooldown
## Scope
ProviderHealthPolicy is a deterministic state machine (healthy/degraded/faulted), three consecutive failures trigger 30s cooldown; URU owns per-provider health and excludes temporarily faulted candidates, leaves Object registered. HubUnit reports incidents to OMU EHU (503/504) and cooldown rejection 429. No persistent heal state across reload.

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
