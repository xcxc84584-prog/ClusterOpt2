# ClusterOpt2 — PLUGIN PR04 Patch6 Handoff

Working node: PR10 / PLUGIN PR04.06 (major PR #45 Draft).
Previously accepted 04.01–04.05; Patch6 is pending latest-head CI.
Branch: plugin/pr04-service-routing. Do not merge main until PR04.10.

Read PRD, Plan, ArcD, Relation Test, Patch(+6), global Property list,
open-issues list and latest GitHub head before any next modification.
SOP: PRD -> Plan -> ArcD -> Implementation + Relation Test -> Project.

Observe is a metadata-only sidecar. Primary receives payload and retains
its result; observer gets only service/action/status/ok, via HubUnit.request
and original origin ACL. Observer failure is isolated and recorded as EHU.
No shared EDPMU property or public Cluster.api route mutator added.

Next: PR04.07 Response Pipeline; keep Event ID lineage, authorization,
no content leak. Then PR04.08 ACL, PR04.09 preview, PR04.10 regression.

Syntax highlighting future L3: programming-language ID + grammar Provider
registry, independent from UI locale, plain-text fallback. Single product
version authority ReleaseVersion.js, major-only merge and restore gate.
