# PLUGIN PR04 — Patch(+3)

## Change set
- ServiceRequestResolver selects an explicitly scoped replace Provider
  by Service/action, origin, registered source and priority.
- HubUnit.configureReplaceRoutes validates and atomically swaps an
  immutable complete Route Table; invalid/absent Providers reject all.
- LinkCore host-only helper; not in browser Cluster.api.
- Disable, health exclusion and unregistration produce an explicit
  404 instead of falling back to another Provider.
- Full existing request/response authorization and OMU path retained.
- New PR04.03 Node/VTE/negative/ACL regression tests.

## Intentional limits
No routeVersion or inflight draining (PR05). timeoutMs remains metadata
until bounded execution is implemented. No untrusted route editing
until PR04.08 permission design. No product version bump.

## Acceptance
Exact-head workflows to be recorded in PR #45 after CI completion;
not a claim of physical 5GiB or manual browser File System API PASS.
