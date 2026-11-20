# PR24 Patch(+14) — Multi-Worker Session isolation and VTE gate

Date: 2026-11-20.
PR: https://github.com/xcxc84584-prog/ClusterOpt2/pull/80
Branch: `feature/pr24-bidirectional-plugin-sdk` (Draft, main untouched).

## Baseline (Patch +13)
- Exact SHA `2eda9c61ac51b54ca978b287fba2a6a7269d4f74`.
- All four GitHub Actions workflows PASS.
- OCDA Chromium Browser: 172/172 PASS.
- No new CI error was present at the start of Patch(+14).

## Security defect closed
The shared `PluginHostRequestGateway` previously accepted any
URU-registered Provider ID on a second `create()` call. Its active
scopes were Host-approved for the owning Plugin, not for arbitrary
other URU Providers. A Host integration bug could therefore attach a
second Provider to an existing Gateway and unintentionally share
its route capabilities.

`PluginHostRequestGateway` now pins a private
`#ownerProviderId` and `#ownerObjectId` at first successful
Session creation. Further ports must match both exactly.
Foreign Provider attachment returns 403 and an
`RPC.ForeignProviderRejected` OMU EHU event. Multiple ports
belonging to the same Provider are permitted; the owner pin is
retained across Session detach/rekey.

This is Host-only identity enforcement. It adds no new Worker
API, no unrestricted Host capability, no second URU registry.

## New real MessagePort tests

`Implementation/tests/pr24-multi-session-vte.test.js`:

1. **PR24.16** — two concurrent Worker MessagePorts sharing one
   Provider receive distinct Session IDs, may send the same
   requestId independently, and do not share replay windows.
   Third-party foreign Provider attach to the same Gateway gets
   403 with EHU evidence.
2. **PR24.19/20** — old Provider Port teardown is followed by a
   separate Host Gateway for a new Provider. A prior route receives
   403; a separately approved new route succeeds and logs the
   correct Provider/Object source.
3. **PR24.48** — revoke one exact scope while Slow Host work is
   pending on two real Ports. Both requests get a correlated 403,
   unaffected Fast requests succeed independently, no late data
   is sent to either caller, and resource reservations release
   only after the underlying Host promises finish. OMU logs both
   `RPC.ScopeRevokedInflight` events.

## Backlog reconciliation
`PR/PR24/Remaining-Requirements.md` is now v24.14.
The new planning buckets are 17 baseline-implemented,
65 partially implemented, 18 without verified corresponding
delivery. The original 100 requirements are preserved.
**Zero** requirements are formally marked PASS in the
per-subPR Acceptance Matrix; statuses reflect code evidence
rather than end-to-end signoff. Existing third-party Echo,
Delegate and Native UI SDK examples were reconciled so they
are not incorrectly labeled as never implemented.

## Load and security limitations
- This fixed-size VTE tests two active Ports, not a global
  high-volume fairness benchmark or production memory pressure.
- Cross-tab BroadcastChannel revoke is eventual, not a globally
  atomic cross-device guarantee.
- Host Gateway owner pin prevents accidental cross-Provider
  scope sharing but does not substitute for URU/HubUnit ACL,
  explicit reviewed rpcScopes and per-Session authentication.
- Non-cooperative Host work may ignore AbortSignal, retain
  in-flight reservations and cause side effects until it settles.
- Full dependency rollback, portable backups, UI CRUD/UISP,
  threat model audit and API Catalog coverage remain pending.

## Release gate
Do not mark this patch CI-PASS without checking all four
workflows against the final exact HEAD. On failures, inspect
Node/VTE/Browser job logs and fix the test or code honestly.
PR #80 remains Draft, do not merge main automatically.
