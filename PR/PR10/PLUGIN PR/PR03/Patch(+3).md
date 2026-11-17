# ClusterOpt2 PLUGIN PR03 Patch(+3) — URU Provider Registration Bridge
## Scope
Add URU.providers and providerServices metadata structures as sole Object-linked authority. HubUnit checks caller identity, URU validates Manifest v1, action must be declared on existing Object. Object unregister purges Provider metadata. 201/400/403/404/409, EHU+Log. No external registration Facade, no executable runtime. O(number of provided services) index updates.

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
