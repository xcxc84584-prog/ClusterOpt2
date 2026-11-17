# PLUGIN PR05 Plan

## PR05.01–03
Create immutable Route Table snapshots with monotonic runtime generation; bounded host-only candidate transactions; dry-run full HubUnit validation and CAS commit. Existing host configuration also increments generation. No new browser route mutation API.

## References
- https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostExtensionService.ts
- https://www.envoyproxy.io/docs/envoy/latest/api-docs/xds_protocol

## Risk / complexity
O(route table size) validation; 16 pending candidates maximum; no persistence or untrusted code. Stale commit = 409, unvalidated commit = 412. Remaining: inflight drain, rollback, re-registration and concurrency stress.

## Patch2 — Inflight and bounded rollback

PR05.04: keep routeVersion pinned synchronously before async work, retain generation-specific in-flight counts and wait for drain without modifying API envelopes. PR05.05: route drain tracking is implemented but cancellation/unregister gating remains pending. PR05.06: explicitly regression-test fail-closed 404 for disabled Provider. PR05.07: bounded immutable history, revalidate rollback under CAS and always generate a new version. PR05.08: test runtime reload clears pending candidates. PR05.09/10: EHU and repeated-version pressure regression. No new workflow, no browser mutation API.
