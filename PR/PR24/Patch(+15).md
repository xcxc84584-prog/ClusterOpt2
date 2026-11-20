# PR24 Patch(+15) — Crash restart backoff and isolation

Date: 2026-11-20.
PR: https://github.com/xcxc84584-prog/ClusterOpt2/pull/80
Branch: `feature/pr24-bidirectional-plugin-sdk` (Draft).

## Verified baseline (Patch +14)
Exact HEAD `ae7a503b5ffd55a24bb754d5e8a32bd14facd827`:
4/4 GitHub Actions PASS. Both independent Browser Playwright
jobs 172/172 PASS. New multi-Session Node VTE included.

## Implementation
- `Implementation/property/PluginRestartCircuitPolicy.js`
  is a Host-only pure policy: 60s rolling fault window,
  1st/2nd/3rd unexpected Worker faults back off for
  1500/6000/60000ms, with an open circuit on the third.
- `PluginHostInstallUnit` owns private per-Provider `restartFaults`
  and a test-injectable clock. The existing `onFault`
  handler disables just the owning Provider and now records
  a fault in its local restart history.
- `install` checks the Provider restart state *after* explicit
  consent/review and *before* any new Worker bootstrap, returning
  429 + `retryAfterMs` while blocked. Uninstall does not reset
  fault history; a new unrelated Provider is not affected.
- Only an explicit Host-confirmed
  `resetRestartCircuit(providerId,{consented:true})`
  clears the in-memory history. Unconsented reset is 403.
  None of these APIs are available to a Worker plugin.

## VTE/Unit evidence
`Implementation/tests/pr24-restart-circuit-vte.test.js`
validates pure backoff policy, expired history, bad input,
three real VTE reinstall cycles, exact 429 rejection,
uninstall bypass refusal, peer isolation, EHU evidence and
explicit consent-only reset.
Existing `pr24-upgrade-safety.spec.js` continues to check
real Worker crash, Provider disable and port/session cleanup.

## Caveats
- In-memory fault history survives uninstall/reinstall only
  inside the current Host Installer. Page reload creates a
  new in-memory state; persistent cross-tab/cross-device
  crash quarantine is not yet available.
- Does not replace actual CPU/memory quotas or global RPC
  concurrency fairness; misbehaving Host work may continue
  after receiving AbortSignal.
- PR24.85 is **partial**, not a release PASS. Full
  PR24.01–100 signoff remains pending.
- Verify *final exact SHA* CI (four workflows, VTE and E2E),
  fix real failures, remain Draft, do not merge main.
