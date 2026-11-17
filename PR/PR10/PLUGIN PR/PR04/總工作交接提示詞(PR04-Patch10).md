# ClusterOpt2 — PLUGIN PR04 Patch10 Final Handoff
## State
Major PR10 / PLUGIN PR04 (#45), PR04.01–08 already accepted.
PR04.09 + PR04.10 implementation committed as a single latest-head
release candidate. CI and final backup MUST be checked before merge.
Read this, PRD/Plan/ArcD/Relation Test/Patch9/Patch10, global Property
registry and unresolved issues before new implementation.
## System
HubUnit + URU are the only executable routing/Provider authorities.
RouteQueryPolicy validates selector data; RouteReadFacade fixes browser
source ui and origin user, exposes list/describe/preview only.
Preview never executes Providers or allocates dependency edges.
Owned list/describe hide host routes and foreign Provider identities.
RouteExecution: replace, chain, fanout, observe and response pipeline
all pass original HubUnit request permission path.
## Release
One major PR, one merge. Canonical ReleaseVersion.js product 0.0.10
stable; package mirror; no new workflow. Verify full exact-head CI,
pre-major baseline, final accepted checkpoint, then mark ready and merge.
Next major: PR05 Route Transaction/CAS/rollback; no implicit auth grant.
L3 syntax extension remains programming-language-ID/grammar keyed
independent of UI locale with plain-text fallback.
