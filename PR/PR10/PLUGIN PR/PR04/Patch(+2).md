# PLUGIN PR04 — Patch(+2)

## Implemented
New immutable RouteTablePolicy schema v1, max 32 routes/32 KiB,
explicit service/action, source origin/object filters, bounded priority,
timeout and provider list. Reject invalid and ambiguous declarations.
Pure policy: no new Hub/URU authority, no runtime route activation.
Added Node regression suite for negative and VTE-adjacent Hub behavior.

## Deferred
Replace, Chain, Fan-out, Observe dispatch, ACL-controlled commit,
routeVersion and transaction semantics remain future PR04.03–PR05.

## Release and recovery
No draft product version bump; pre-major restore remains
backup/pre-plugin-pr04-20261117. This subPR obtains a checkpoint only
after exact-head CI passes. Do not merge draft PR04 yet.
