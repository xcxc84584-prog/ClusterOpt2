# PR24 Patch(+12) — Independent SDK, symmetric RPC, explicit reapproval

Branch: `feature/pr24-bidirectional-plugin-sdk`
Pull request: https://github.com/xcxc84584-prog/ClusterOpt2/pull/80
State: Draft, no merge to main.

## Goals
- Implement substantial P0 blockers from `Remaining-Requirements.md`
  without pretending all 100 PR24 items are individually accepted.
- Publish an executable, isolated third-party Worker SDK with
  real cross-provider integration, not first-party plugin branches.
- Close previously documented host-only reapproval, UI tab
  isolation and repeated timeout exhaustion gaps.

## Implementation / code evidence

### SDK and third-party Plugin→Plugin
- `Implementation/LinkCore/PluginWorkerSource.js` provides
  `Cluster.version`, `handle`, `service`, `request`,
  `onSessionChange` and `RPCError`. The Worker can register
  only actions declared in its installed Provider Manifest.
- `PluginSandboxBridge` supplies the approved action list,
  not executable capabilities or access to parent Host DOM.
- Independent packages:
  `Implementation/sdk/examples/echo/` and
  `Implementation/sdk/examples/delegate/`, including JSON manifests,
  Worker sources and an Echo tabbed HTML settings page.
- Published ambient API typings:
  `Implementation/sdk/cluster-plugin-sdk.d.ts`, README and examples.
- Real browser E2E installs both independent packages, invokes
  Delegate → HubUnit → Echo, rejects unscoped UICO request and
  validates the SDK version, Session ready state and EHU/OMU routing.

### Symmetric Host→Plugin
- Production Bridge has a Host-only
  `PluginBidirectionalRPCController` bound to the same authenticated
  port/session. Session state and pending request ID are checked before
  adopting a Worker response. The Host replaces Worker-supplied eventId
  with an OMU-generated eventId.
- Steady-state Host invocations use `cluster.rpc/1`; bootstrap
  legacy `invoke` remains compatible pending full migration.
- Worker processes Host request/cancel; cancellation aborts the
  Worker handler's signal and suppresses late responses.
- Browser tests exercise direct Host-to-Worker new protocol,
  routed Host-to-Worker call, and cancellation.

### Explicit reapproval and cross-tab deny-only sync
- IndexedDB revocation store now has a Host-only `clear` operation.
- Host Installer `reapproveRpcScope` requires explicit consent,
  suspends the existing Session, checks that a durable denial exists,
  and grants **only** a route previously approved for this Bridge.
  The denial is cleared only after safe memory grant staging.
  Storage failure rolls back the new memory grant before resuming.
- Plugin Manager lists revoked exact routes and allows explicit
  confirmation-based reapproval.
- Same-origin Browser tabs receive deny notifications through
  BroadcastChannel; receivers **re-read IndexedDB** before revoking,
  never accept transmitted positive grants. Reapproval is not
  broadcast as an automatic grant.

### UI and resilience
- Workbench tabs use Provider-specific IDs, exclusive activation,
  and Host-owned cleanup for any installed external `uiEntry`.
- Sample settings UI owns its own General/Advanced tabs inside an
  opaque-origin iframe; it cannot read the main page's DOM.
- Host-side bounded circuit opens after three deadline failures in
  rolling 60s; subsequent requests get typed 503
  `RPC_CIRCUIT_OPEN`. The circuit survives Session rekey and
  needs an explicit Host-confirmed reset.
- Worker crash terminates its sandbox and pending RPC, while
  PluginHostInstallUnit disables only that live Provider, preserves
  unrelated providers and records EHU.

## Test evidence added
- `Implementation/tests/pr24-rpc-revocation-persistence.test.js`
  reapproval, consent denial, storage-failure rollback and scope limits.
- `Implementation/tests/pr24-messageport-integration.test.js`
  three timeouts / circuit 503 / Session rekey / explicit reset.
- `Implementation/tests/pr24-rpc-circuit-policy.test.js`
  pure time-window and invalid input tests.
- `Implementation/e2e/pr24-persisted-revocation.spec.js`
  same-origin cross-tab denial, explicit regrant and rekey.
- `Implementation/e2e/pr24-sdk-third-party.spec.js`
  executable third-party samples, scoped Plugin→Plugin, Host→Plugin
  symmetric Controller, cancel, tabbed UI, isolation and teardown.
- `Implementation/e2e/pr24-upgrade-safety.spec.js`
  unexpected Worker fault disables only its Provider and clears
  Host ports and sessions.
- Prior Patch(+11) verified with 4/4 GitHub workflows and
  162/162 Playwright tests on its exact HEAD; Patch(+12) requires
  **a fresh exact-HEAD check** and must not inherit that result.

## Known gaps / nonclaims
- This does NOT complete PR24.01–100 formal individual signoff.
- Cross-tab denials are eventually synchronized; no global atomic
  transaction ordering or cross-device broadcast guarantee yet.
- SDK does not expose arbitrary native UI mutation. Full UISP CRUD
  matrices, component owner ACL and accessibility/cross-browser
  conformance still require specific evidence.
- Open circuit stops new RPC, but cannot reverse Host side effects
  or interrupt noncooperative Host promises synchronously.
- There is no measured model-token overhead benchmark, memory
  profiler across browsers or formal independent security audit.
- Event chain, durable Package/Provider rollback and multiple
  simultaneous Worker sessions still need adversarial tests.
- No main branch merge without accepted 100-item evidence,
  exact-HEAD CI/VTE, external SDK parity and recoverable backup.

## Next gate
Run current exact-HEAD `npm run check`, Playwright and four GitHub
CI workflows. Fix real failures with no weakened security assertions.
Update per-item acceptance matrix only after tests pass.
