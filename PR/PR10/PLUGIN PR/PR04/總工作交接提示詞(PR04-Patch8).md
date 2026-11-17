# ClusterOpt2 — PLUGIN PR04 Patch8 Handoff

Working major PR10 / PLUGIN PR04 (#45 Draft; main unchanged).
PR04.01–07 PASS. PR04.08 implementation submitted pending exact-head CI
and restore ref; never treat a submitted commit as verified.
Read latest PRD, Plan, ArcD, Relation Test, Patch(+8), global Property
registry, pending-problems list and GitHub head before any work.

PR04.08: RouteControlPolicy requires a registered host-verified owner,
sourceFilter.objects exactly [owner], and ownership of all selected
Provider IDs (including Response Pipeline stages). Scoped updates leave
other owner routes intact. Dependency DFS rejects cyclic chain/response
edges atomically. Existing HubUnit.request continues enforcing real
runtime ACL and EHU/Dependency. configureOwnedRoutes is trusted
in-process only, not Cluster.api or AgentAPI. Do not confuse source
string parameters with authenticated identity; external controls require
separate trusted auth boundary, planned later.

Next: PR04.09 read-only route list/describe/preview; PR04.10 full
relation/VTE/browser gate and guarded major PR release/merge. PR05
handles routeVersion/CAS/drain/rollback; PR06 untrusted Worker.
Syntax highlighting eventual L3 is language-ID/grammar Provider keyed
with plain-text fallback independent of UI locale.
