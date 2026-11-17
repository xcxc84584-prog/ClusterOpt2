# ClusterOpt2 — PLUGIN PR04 Patch7 Handoff

## Status
Major PR: PR10 / PLUGIN PR04 (#45, Draft, NOT MERGED).
PR04.01–06 accepted; PR04.07 submitted, CI and restore gate pending.
Working branch: plugin/pr04-service-routing.
Do not publish product version or merge main until PR04.10 PASS.

## Must read next
Read this file, PRD.md, Plan.md, ArcD.md, Relation Test.md,
Patch(+7).md, 全域屬性清單.md and 未完成測試／問題清單(No.1~20).md.
Check current GitHub PR head and restore SHA before any modification.
SOP PRD -> Plan -> ArcD -> Implementation + Relation Test -> Project.

## Implementation contract
Optional Response Pipeline route field, max four stages, data only.
Kinds: validate (must return true), transform, aggregate (fanout first).
Schema compatibility checked at atomic route install; live URU authority
at dispatch; each processor enters via existing HubUnit.request using
real caller/origin. Detach and freeze intermediate value, check 1 MiB
contract, preserve core-owned REP envelope, EHU on fail-closed error.
No new public route mutation, Worker trust, release version or CI suite.

## Later work
PR04.08 Route ACL; PR04.09 read-only preview; PR04.10 full regression.
PR05: routeVersion/CAS/drain/rollback. PR06: untrusted isolation.
L3 syntax highlighter uses programming-language ID + grammar version
Provider registry, independent of zh-Hant/en UI locale, with plain fallback.
