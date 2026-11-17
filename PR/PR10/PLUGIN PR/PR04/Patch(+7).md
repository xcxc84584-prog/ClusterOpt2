# PLUGIN PR04 Patch(+7) — Response Pipeline

## Changes
- Optional responsePipeline field on existing declarative Route Table v1.
- ResponsePipelinePolicy: <=4 schema-valid, data-only stages.
- ServiceRequestResolver: live URU resolution for each processor.
- HubUnit: atomic contract verification and sequential guarded execution.
- validate, transform and fanout-only aggregate semantics.
- Detached frozen stage payload, output bounds, EHU on rejected/failed hop.
- Node/VTE regression and updated OCDA Plan/ArcD/Relation Test/PRD.

## Limitations and gates
No untrusted sandbox or route ACL management is granted. No hard timeout,
CAS routeVersion, or 5GiB file-permission claim. Only existing CI workflows.
Do not mark PASS or establish verified restore until latest-head full
Node+Chromium+PR01/02/03/Windows test gate completes.
