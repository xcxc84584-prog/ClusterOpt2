# ClusterOpt2 — PLUGIN PR04 Patch3 Handoff

## Progress
Major PR04 on plugin/pr04-service-routing (Draft; not merged).
PR04.01 PASS at 65eaab6; PR04.02 PASS at 1bc9637.
PR04.03 Replace Service/action route submitted; check latest-head CI
and create verified rollback branch before marking PASS.
PR04.04 next: Chain execution with per-hop contract checking.

## Mandatory next-session reads
Read this file, 全域屬性清單.md, 未完成測試／問題清單(No.1~20).md,
PR04 PRD, Plan, ArcD, Relation Test, latest Patch(+3), and compare
relevant GitHub projects before the next small PR implementation.
SOP PRD -> Plan -> ArcD -> Implementation + Relation Test -> Project.

## Architecture and safety
HubUnit owns the in-memory replace-route snapshot; URU still owns
Provider lifecycle/index; EDPMU remains sole shared Property authority.
No silent fallback if chosen Provider disappears or is disabled.
Existing HubUnit.request provides ACL, origin-specific API, scheduling,
EHU/Log and Dependency; direct target-ID calls remain compatible.
The trusted host configuration is NOT a new browser Cluster.api endpoint.
External route configuration ACL is deferred to PR04.08. PR05 handles
CAS/routeVersion and in-flight draining. No unauthorized plugin execution.

## Multi-language syntax highlighting
Later L3 grammar Providers are selected by extensible programming-
language IDs, separate from UI translation locales. Plain text is safe
fallback; plugins may only output validated decoration spans.

## Version and recovery
ReleaseVersion.js is canonical; package.json mirror only.
No draft product version bump, no PR04 merge until 04.01–04.10 gates.
Pre-major backup/pre-plugin-pr04-20261117, per-subPR restore checkpoint
after verified latest-head CI. Supersede redundant unfinished workflow
runs, never duplicate a CI workflow.
