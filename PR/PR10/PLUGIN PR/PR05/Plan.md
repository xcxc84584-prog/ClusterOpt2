# PLUGIN PR05 Plan

## PR05.01–03
Create immutable Route Table snapshots with monotonic runtime generation; bounded host-only candidate transactions; dry-run full HubUnit validation and CAS commit. Existing host configuration also increments generation. No new browser route mutation API.

## References
- https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostExtensionService.ts
- https://www.envoyproxy.io/docs/envoy/latest/api-docs/xds_protocol

## Risk / complexity
O(route table size) validation; 16 pending candidates maximum; no persistence or untrusted code. Stale commit = 409, unvalidated commit = 412. Remaining: inflight drain, rollback, re-registration and concurrency stress.
