# PLUGIN PR03 — Plan.md
## SOP
PRD → Plan → ArcD → Implementation + Relation Test → Project.
Read latest PLUGIN PR02 handoff, global Property registry and pending
issues; preserve LinkCore/HubUnit/URU/EDPMU/OMU authority.

## PR03.01 — Canonical Capability IDs
Upstream GitHub review:
- VS Code extension identifiers and extension-host contract:
  https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/extensions/common/extensions.ts
- Theia plugin protocol and identifier handling:
  https://github.com/eclipse-theia/theia/blob/master/packages/plugin-ext/src/common/plugin-protocol.ts
- VS Code extension manifest design:
  https://github.com/microsoft/vscode-docs

Improvement: a *single* immutable shared policy defines service identity
independently of Provider identity, version negotiation, permissions,
runtime factories and REQ routes. One service may have many Providers;
do not confuse repeated Provider services with repeated Service IDs.

Grammar: 2–8 dot-separated lowercase ASCII segments. Every segment
starts with a-z, followed by a-z/0-9 or single hyphen-separated tokens;
each <=32 chars; whole ID <=128 characters. No @version suffix:
SemVer belongs in the manifest. No normalization of unsafe mixed-case
identifiers; reject them instead. No arbitrary prototype-like keys.
Pure bounded checkUnique returns 409 for duplicate canonical Service ID
in an explicitly provided *Service ID list*, and never reserves a name.

One Property file CapabilityIdPolicy.js registered once by LinkCore via
HubUnit into EDPMU (Public metadata policy, not permission).
No new Object or registry; no UI change, file write or plugin execution.
O(length) validation, O(n) collision scan with <=4096 entries.
Node detached VTE and Chromium integration plus global regressions.

## Merge safety
Main baseline 5191ffc8d1ae7996526b8808bd535a330c1f6269.
Before merge, all 10 subPR gates must pass at exact head; branch restore
must point to pre-PR03 main and latest PR03 head. No early merge.
