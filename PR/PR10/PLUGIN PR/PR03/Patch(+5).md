# ClusterOpt2 PLUGIN PR03 Patch(+5) — ServiceRegistry Candidate Index
## Scope
URU maintains Service ID => Provider IDs index, removing stale IDs on unregister. Separate ServiceRegistry is read-only live projection, returns 200/400/404 and multiple candidate manifests. Candidate listing never instantiates factories or chooses an active route. O(1) map lookup plus O(number of candidates) projection.

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
