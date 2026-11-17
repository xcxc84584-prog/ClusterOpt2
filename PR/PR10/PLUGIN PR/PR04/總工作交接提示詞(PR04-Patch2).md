# ClusterOpt2 — PLUGIN PR04 Patch2 Handoff

## Current progress
PR04.01 implemented and CI verified at 65eaab61b8308c2d6db3a6dc1052161652e190fc.
PR04.02 Route Table schema implementation committed on
plugin/pr04-service-routing. Verify latest-head CI before PASS.
PR04.03 next: Replace route on one service/action using a guarded HubUnit
selection path, not direct access to URU or Object private state.

## Mandatory reads
Read this handoff, 全域屬性清單.md, 未完成測試／問題清單(No.1~20).md,
PR04 PRD/Plan/ArcD/Relation Test/Patch(+2), and inspect related upstream
GitHub architecture before EVERY next implementation.
SOP: PRD -> Plan -> ArcD -> Implementation + Relation Test -> Project.

## Rules
One major PR at a time; PR04 remains draft until 04.01–04.10 pass.
No subPR merge, publish or product version bump. Unified release authority:
Implementation/property/ReleaseVersion.js; package.json mirror only.
Restore pre-major from backup/pre-plugin-pr04-20261117.
Do not duplicate CI workflows; supersede unfinished equivalent checks.

## PR04.02 contract
RouteTablePolicy.validate(data) is side-effect-free and detaches
immutable snapshots; no route execution or authorization from schemas.
Provider lookup stays URU-owned; HubUnit retains all REQ/REP/ACL and
EHU/Log. L3 syntax highlighters must use extensible programming-language
IDs and grammar Provider versions, independent of UI localization.

## Claims boundary
Node tests and CI should be recorded with exact SHA; no physical 5GiB
or manual File System Access pass is implied by workflow success.
