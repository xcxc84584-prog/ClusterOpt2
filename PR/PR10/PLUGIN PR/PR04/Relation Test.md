# PLUGIN PR04 — Relation Test

## PR04.01 automated assertions
- Existing target-ID request unchanged and still returns 200.
- One Provider is selected by canonical Service/action.
- Malformed selector/options => 400, missing => 404, ambiguous => 409.
- Disabled Provider is excluded; enabling it restores ambiguity.
- UserAPI, AgentAPI and AccessPolicy still enforce original 403.
- EHU records resolution failures and authorized Request/Response.
- VTE isolated; request graph has forward=10 and reverse=01.
- No implicit materialization or persistent Provider index.
- Browser Chromium integration leaves original Cluster.api unchanged.

## Gate
Pending exact latest-head CI success. Code submission is NOT proof.
No real 5GiB editor or physical file-permission acceptance is claimed.

## PR04.02 — Schema and regression assertions
- Valid input returns detached deeply frozen schemaVersion=1 data.
- Replace, Chain, Fanout, Observe are declared but NOT executed.
- Invalid schema, key injection, accessors, cyclic structures and sparse
  arrays fail 400 without side effects or getter evaluation.
- Reject duplicate route IDs, same selector/priority collisions,
  provider duplication, invalid source/origin, unsupported timeouts.
- Existing HubUnit request/requestService remain unchanged.
- Exact-head Node and Chromium CI results must be checked after push.

## PR04.03 — Replace execution and relation tests
- Explicit origin + registered source matches only scoped routes.
- Higher priority wins; unmatched scope does not silently route.
- Replacing a Service/action does not change direct target-ID API calls.
- Configuration is validated whole-table and swaps only after success.
- Disabled/unregistered chosen Provider => 404 with EHU, no fallback.
- Original UserAPI/AgentAPI and AccessPolicy => 403 with EHU.
- OMU Request/Response and Dependency remain on original Hub path.
- VTE runtime route state isolated from a second LinkCore instance.
- New browser privilege surface and untrusted plugin control absent.
- Existing exact-head Node, Chromium and release CI required for PASS.

## PR04.04–05 Relation Tests
- Chain executes ordered stages, forwarding only validated outputs.
- Adjacent incompatible schema fails configure 409 atomically.
- Runtime mismatched output yields 502 EHU without later chain hops.
- Fanout preserves declaration order regardless of completion timing.
- Fanout rejects partial output on failed/schema-invalid branch.
- Every stage still uses HubUnit.request ACL and dependency edges.
- Disabled Provider fails at resolution (404); no silent fallback.
- Existing PR04.03 replace and legacy target-ID tests stay in suite.
- No route configuration exposed through Cluster.api.

## PR04.06 — Observe relation tests
- One primary plus one or more observers, full-table atomic validation.
- Observer receives frozen {service, action, status, ok} only; no payload,
  response, caller identity or options forwarded as data.
- Primary failure skips sidecar; primary success returns unmodified.
- Observer 403, thrown exception and contract mismatch log EHU but do not
  alter primary REP. Every sidecar uses guarded HubUnit.request.
- Existing Request/Response dependencies remain 10/01; VTE remains isolated.
- Exact-head Node+browser CI and rollback checkpoint required for PASS.
