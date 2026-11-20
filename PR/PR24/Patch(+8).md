# PR24 Patch(+8) — Deadline response and Session rotation regression

Date: 2026-11-20. PR #80 stays DRAFT. No main merge.

## Implementation
- PluginHostRequestTransport emits a typed, contract-validated
  `cluster.rpc/1` response with status 504 / RPC_TIMEOUT when a
  plugin-to-host request exceeds its deadline.
- OMU EHU `RPC.DeadlineExceeded` correlates response eventId to
  requestId, without exposing input payloads or credentials.
- AbortSignal is forwarded as before. A cancelled, revoked or
  suspended Session cannot publish an additional timeout response.
- Existing asynchronous post-dispatch liveness guard suppresses
  late success after deadline or Session rotation.
- Non-cooperative Host work retains its concurrency reservation
  until it actually settles. No side-effect rollback is promised.

## Relation tests
- Real Node MessageChannel: non-cooperative Host request reaches
  deadline, returns exactly one correlated 504, and drops late 200.
- Real Node MessageChannel: suspend while old request is pending,
  tear down listener and Session, resume same port with new challenge,
  deliver only the fresh reply, discard stale result and cleanup.
- Existing PR24 and PR13 regression tests remain unchanged.

## Security / capacity
- No new URI route, public capability or global EDPMU Property.
- URU/HubUnit remain registration / dispatch authorities.
- OMU logs failure EHU; direct plugin caller identity remains
  bound to the host-owned MessagePort Session.
- A Host Object that ignores AbortSignal may continue executing;
  slots are deliberately held until completion, so it can reduce
  availability. Work-stealing, resource budgets and circuit-breaker
  policies require later PR24.81–90 work.

## Verification / release gate
- Source and tests committed to feature/pr24-bidirectional-plugin-sdk.
- Exact final HEAD CI, VTE browser acceptance and independent external
  plugin tests must be confirmed before changing status to PASS.
- PR24.01–100 are not all accepted. Do not merge into main.

## Next
1. Verify all relevant jobs against the latest HEAD.
2. Repair test failures without relaxing assertions.
3. Test rollback/rekey under a true browser Worker in an upgrade.
4. Add fine-grained Object/Action/Property ACL with explicit grants.
5. Build the portable SDK and independent conformance fixtures.
