# PLUGIN PR04 Patch(+8) — Scoped Route ACL and Dependency Gate

- Add RouteControlPolicy: scoped ownership check, static dependency DAG.
- Host-only HubUnit.configureOwnedRoutes and LinkCore forwarding.
- Preserve other owners' routes on scoped update/clear.
- Reject foreign provider, unauthorized scope, missing identity and
  dependency cycles with EHU/403/404/409; no partial update.
- Node/VTE tests, OCDA Plan/ArcD/PRD/Relation Test and handoff.

Exclusions: no external authenticated route-config API or Browser/Agent
mutation, no routeVersion CAS, untrusted runtime, hard timeout, release.
Acceptance requires five latest-head CI PASS and exact SHA backup ref.
