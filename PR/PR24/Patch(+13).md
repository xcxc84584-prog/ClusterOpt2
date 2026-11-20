# PR24 Patch(+13) — Correlated RPC audit IDs and visible UI slots

Date: 2026-11-20.
PR: https://github.com/xcxc84584-prog/ClusterOpt2/pull/80
Branch: `feature/pr24-bidirectional-plugin-sdk` (Draft).
Main branch remains untouched.

## Scope
PR24.22/23: repeated Host→Plugin RPC replies must settle
independently under the same authenticated Session.
PR24.62: externally created Host toolbar controls must be
visible without opening a hidden native submenu.

## Root-cause evidence
- The original browser regression completed 170/172 tests,
  later 171/172 after the toolbar correction.
- Four consecutive Host→Worker calls produced responses on
  requests 1 and 3 but timed out on 2 and 4.
- Temporary *test-only* tracing proved Host sent every
  request, the isolated Worker executed each handler, and
  Worker called postMessage for the missing response.
- `ObjectManagementUnit.record` coalesced identical successful
  `Log` events within 1000ms even when each had a different
  `details.requestId`. The second call therefore returned
  `null` instead of an audit object. The Bridge accessed
  `audit.eventId`, threw inside the Port event callback,
  and never settled the Controller, causing status 504.
- Exploratory "single listener" and "direct Worker Port"
  changes did not fix this cause. They were reverted to
  avoid unnecessary lifecycle/Session regressions.

## Implementation
- `ObjectManagementUnit.record` now exempts **correlated
  successful events with non-empty requestId** from PASS
  log cooldown. Each gets its own monotonically increasing
  Event ID. Ordinary uncorrelated repeated PASS events remain
  cooled, and EHU/errors remain uncoalesced.
- `PluginSandboxBridge.receiveBidirectional` rejects a
  missing or invalid audit ID without throwing or leaving
  requests pending until timeout. No worker-provided Event ID
  is trusted.
- `PluginUIControlAdapter.resolveSlot` mounts external
  `slot.plugin-toolbar` controls in the visible Host
  `.header-utility`. Reduced Hosts without that surface
  retain the legacy `toolOptions` fallback. The Slot ID is
  fixed by Host policy; arbitrary selectors are never accepted.
- Kept UICO native ownership, HubUnit permissions, Provider
  identity and uninstall teardown unchanged.
- Removed all temporary E2E instrumentation, including
  Worker postMessage interception. The acceptance test now
  imports the original third-party Echo package unchanged.

## Validation
- New Node/VTE regression:
  `Implementation/tests/pr24-omu-correlated-rpc.test.js`
  asserts four PASS events with distinct Event IDs at a
  frozen clock timestamp; checks uncorrelated event cooling
  remains unchanged.
- Updated actual Worker Playwright E2E:
  `Implementation/e2e/pr24-sdk-third-party.spec.js`
  makes four consecutive calls on the same Session,
  including one via HubUnit, asserts four valid responses
  and unique positive Host-generated event IDs.
- Third-party native Button/Window/Tab E2E
  verifies true visibility and cleanup.
- Required gate: four GitHub workflows PASS on the
  **final exact HEAD**; an older successful commit is
  insufficient. Do not treat CI success as 100/100
  subPR acceptance.

## Remaining work
100 individual PR24 subPR evidence rows are not fully
signed off. Other risk areas include durable release rollback,
full UISP CRUD matrix, cross-browser conformance, load limits,
cross-tab atomicity, SDK token/load benchmark, security review,
and backup/merge gate.

## Restore/merge
PR #80 must stay Draft until accepted release gates and
recoverable backup. No merge to main in this patch.
