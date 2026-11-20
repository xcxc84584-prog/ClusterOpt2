# PR24 Plan — Independent Plugin SDK and Bidirectional RPC

Status: DRAFT. Base: main (after PR23 merge). Date: 2026-11-20.
Scope: PR24.01–PR24.100. No production release or main merge until
independent third-party integration, VTE and all required CI pass.

## PRD
A third-party plugin, provided as an independent folder/package, can
register its own services, invoke authorized host/other-plugin services,
render isolated UI, use the public SDK and recover from lifecycle events
without editing ClusterOpt2 first-party source files.

## Baseline and dependencies
- PR23 #79 was merged before this branch was cut.
- URU: runtime registrations; EDPMU: shared Property authority.
- HubUnit: sole cross-object Request/Response/Property gateway.
- OMU: persistent audit chain and mandatory failure EHU.
- PR13 sandbox uses isolated iframe/Worker and a transferred MessagePort.
- Existing PluginRPCContractPolicy is legacy host-invocation format.
  Keep it compatible during migration; never treat its old schema as
  evidence of full bidirectional support.
- New schemas cannot grant capabilities by themselves.
- Read 全域屬性清單.md and latest handoff before each implementation.

## Milestone acceptance gates
| Items | Acceptance |
| --- | --- |
| 01–10 | Public inventory, symmetric contract, attack tests |
| 11–20 | Trusted MessagePort-bound sessions and replay rejection |
| 21–30 | Bidirectional RPC, concurrency, deadlines, cancellation |
| 31–40 | HubUnit/URU/OMU/EDPMU route and event correlation |
| 41–50 | Runtime capability and object/action/property ACL |
| Patch(+9) | Strict per-route `rpcScopes`, explicit install/upgrade approval and exact Property.Read dispatch; runtime per-scope revoke remains pending |
| 51–60 | Standalone SDK, typed exports, pure external integration |
| 61–70 | Isolated plugin UI, UISP, window and tab E2E |
| 71–80 | Multi-file package install/upgrade/unload rollback |
| 81–90 | Resource limits, circuit breaker, isolation and benchmarks |
| 91–100 | External examples, VTE/CI, rollback, docs and release |

## Protocol and capacity baseline
- Envelope: cluster.rpc/1, request/response/cancel, two directions.
- IDs: bounded printable identifier, caller identity not in payload.
- Object path and action are strictly bounded.
- Shared legacy PluginMessagePolicy cap: 65,536 UTF-8 JSON bytes,
  maximum depth 8, 128 properties per object/array.
- Request deadline: 1–30,000 ms; reverse Host MessagePort emits a
  correlated 504 on deadline expiry and aborts the forwarded signal.
  The in-flight reservation stays occupied until the Host request settles,
  so a non-cooperative Object cannot silently create unlimited work.
  Host-side fairness and whole-plugin resource quotas remain unimplemented.
- Current protocol validation is separate from session authentication.
- Response and EHU correlation must use requestId, eventId and
  optional parentEventId, verified during integration.

## Security and flow assumptions
Never accept a client-supplied caller identity or re-register unknown
untrusted providers to obtain authority. Session binding is derived
from the trusted transport, with runtime ACL evaluated at dispatch.
No eval, arbitrary DOM access, filesystem handle, key or absolute path
is exposed to plugins. Reject unsupported schemas and versions closed.
Require rollback on partial installation and UI batch failures.

## Implementation strategy
Preserve existing routes until replacement tests demonstrate parity.
Add focused Object/Property files; test both valid and malicious inputs.
Track p50/p95 latency and memory where observable; report browser memory
measurement limitations rather than claiming unavailable guarantees.

## Reference architectures to compare before next milestone
VS Code extension host and contribution points, message passing and
webviews; GitHub Actions permission scoping and cancellation; browser
MessageChannel and sandbox isolation; Node test runner and Playwright.
Reference review is an engineering task, not an assertion of parity.

## PR24 Patch(+9) — reverse RPC scope contract
- Optional `rpcScopes` is a data-only plugin package manifest field,
  independent from the URU Provider declaration and its permissions.
- A scope contains exact `target` and `action`, and, only for
  `HubUnit / Property.Read`, a mandatory exact `property` name.
- No wildcards, prefix matching, implied descendants or implicit grants.
  A package without approved scopes has **zero** reverse RPC access.
- The host must show requested scopes to the user and pass the exact
  approved set to install/upgrade; unapproved declarations fail closed
  before code bootstraps. Existing direct Host->Worker invoke stays.
- At dispatch, the Session must be ready, URU Provider enabled, all
  existing PluginPermission grants live, and exact RPC scope approved.
  HubUnit still checks UserAPI visibility, Object ACL and Property ACL;
  no authority is moved into PluginRPCScopePolicy.
- Route grants are host-only and tied to the active Bridge/Session.
  Fine-grained mid-session scope revocation, runtime VTE and a formally
  versioned public SDK remain later milestones.

## PR24 Patch(+10) — in-session RPC grant revocation
- A trusted Host (Plugin Manager / PluginHostInstallUnit) may revoke
  an individual preapproved exact reverse RPC scope. This is **revoke
  only**; adding grants requires a fresh explicit consent transaction.
- Gateway owns an immutable active scope snapshot. Scope removal is
  idempotent via 404 on already revoked entries and is never restored by
  disable/enable Session rotation.
- Transport keeps a bounded map of active request controllers and the
  resolved target/action/property identity (no raw Host payload logs).
  Revoking a scope aborts only matching requests. One 403
  `RPC_SCOPE_REVOKED` response is emitted per affected in-flight
  request, carrying requestId + OMU eventId. Unrelated requests continue.
- Noncooperative Host Objects may still finish their side effects:
  the stale response must be discarded, and their concurrency slots
  remain reserved until completion. Abort is best-effort, not rollback.
- After revocation, new requests to the removed route are denied by
  Gateway before Hub dispatch. Plugin cannot mint new Host grants.
- UI presents only **approved active** scopes with a separate revoke
  button; revoked routes cannot be re-granted without a new consent.
- Tests: real MessageChannel revoke-in-flight and rekey isolation;
  targeted Gateway unit tests and actual Worker browser E2E.
- Future work: durable consent revocation across page reload, distributed
  multiple simultaneous plugin ports, fault injection VTE, resource
  budgets, and complete SDK capability conformance.

## PR24.01–100 reorganized acceptance checklist
The authoritative **planning** checklist for all 100 proposed subPR
work items is `PR/PR24/Remaining-Requirements.md`. It reorganizes
the existing ten group gates (01–10, ..., 91–100) without claiming
that the earlier group-level implementation proves each task PASS.
Use its three evidence states: baseline implemented, partial, and
not-yet-evidenced. Each subPR still requires independent source/test
mapping, OCDA documentation, VTE, exact-HEAD CI and rollback evidence.
Prioritize P0: persisted revoke safety, pending upgrade rollback,
full public SDK and Plugin→Plugin calls, external UI, quotas, E2E.

## PR24 Patch(+11) — persistent revocation and upgrade drain
- New Host-owned IndexedDB **deny-only** `PluginRPCRevocationStoreUnit`
  records exact providerId + target/action/property revoked scopes.
  Denial metadata confers zero authority and is never imported as a
  positive consent grant.
- On install, the Host reads the persisted denial list before the
  Worker bootstraps. An unchanged manifest and blanket
  `approvedRpcScopes` do **not** restore a previously revoked scope.
  A separate explicit regrant ceremony is pending; no silent recovery.
- Plugin Manager uses asynchronous `revokeRpcScopePersisted`:
  revoke the live Gateway immediately, then commit the denial record.
  If persistence fails, the Provider is disabled/suspended and the
  UI reports failure (503) rather than claiming durable success.
- If denied scope storage cannot be loaded for a scoped plugin,
  installation fails closed with 503 before Worker bootstrap.
- Upgrade now blocks if either HubUnit's Host→Plugin
  `providerInflight` or the isolated Bridge's Plugin→Host
  request count is nonzero, before any Provider teardown.
- Real Worker Playwright E2E exercises persisted deny after
  `page.reload()`, reverse in-flight upgrade 409, failed Worker
  replacement restoring previous URU Provider, Session and UI.
- VTE/Unit tests exercise Host re-instantiation with shared denial
  data, storage failure and pending upgrade without losing old state.
- Next: explicit revoked-route reapproval UX, durable consent
  version migration, multi-Session guard, plugin-independent SDK.

## PR24 Patch(+12) — third-party conformance, reapproval and resilience
- Publish a versioned ambient Worker SDK with `Cluster.handle`,
  `Cluster.service/request`, `Cluster.onSessionChange`, structured
  RPC error and bounded callback/resource contracts. Only approved
  manifest-declared actions can be registered or invoked.
- Provide standalone third-party sample packages under
  `Implementation/sdk/examples/`: Echo and Delegate. Their source
  files MUST NOT import internal LinkCore modules or bypass the Host.
- Worker → Host → third-party Worker routing must pass URU, HubUnit,
  Session authentication, per-Object/Action scopes and live ACL.
- Introduce explicit consent-based reapproval of durable denials.
  Suspend the Session, grant only an **originally reviewed** scope
  in memory, clear the denial record, then resume with a new
  challenge. If persistence fails, rollback memory grant first.
- Broadcast deny-only notifications between same-origin tabs.
  Receivers must re-read IndexedDB; never trust a broadcast as a
  positive grant. Cross-tab synchronization is best-effort/eventual.
- Give all sandboxed UI plugins Provider-specific workbench tabs
  without first-party per-plugin source edits. Preserve the host
  editor/PowerShell as separate native tab owners.
- Add a Host-owned bounded reverse RPC timeout circuit (three
  deadlines within 60 seconds). Reject future route work with typed
  503 until explicit trusted Host reset. Do not erase circuit on rekey.
- Continue Host→Worker migration to the symmetric protocol for
  authenticated Session-ready calls; retain the old invoke protocol
  during bootstrap for compatibility.
- Isolate unexpected Worker faults by disabling only its registered
  Provider and freeing the underlying Bridge/ports/listeners.
- Tests: Node/VTE, independent external package E2E,
  permission-negative tests, cross-tab browser tests, tabbed UI
  isolation/cleanup, typed error, Host→Worker cancellation,
  circuit/timeout, and real Worker crash.
- Do not declare PR24.01–100 complete from one CI green result:
  acceptance remains per-subPR, including performance, quotas,
  cross-browser, accessibility, complete threat-model review.


## Third-party UICO conformance follow-up
The `examples/native-ui` plugin provides an independent test
for externally created native toolbar buttons, settings windows
and tabs via `UICO.uiRequest`, exact route scopes, owner ACL,
`ui.create.own`, `ui.window`, and cleanup. This does not
authorize direct DOM access or erase native UI protections.

## PR24 Patch(+13) — EventChain correlation and native UI visibility
- Every RPC Host→Plugin response with a distinct requestId MUST receive
  a fresh Host-generated OMU Event ID even within the 1-second PASS
  log cooldown. Never use a cooled-out `null` audit record.
- Uncorrelated duplicate PASS logs retain the existing cooldown and
  bounded OMU log memory; EHU failures remain individually recorded.
- A missing audit ID cannot be accepted as a success; the Bridge
  must fail closed without an unhandled exception or silent timeout.
- External `slot.plugin-toolbar` controls must be inserted into an
  actually visible Host-owned header slot, not the hidden File Tool
  submenu. No arbitrary DOM selector is accepted from plugin code.
- Browser acceptance includes four consecutive same-Session Worker
  calls (direct and HubUnit-routed), four unique Host event IDs and
  native Button visibility. Keep old cancel/revoke/upgrade/rekey
  tests unchanged.
- Roll back exploratory port routing changes; preserve the previously
  validated Worker sandbox, Session authentication, iframe relay and
  crash teardown.


## PR24 Patch(+14): multi-Port isolation / multi-Session VTE

Goal: close PR24.16 / .19 / .48 as evidence-backed P0 work,
without expanding plugin-visible authority. The real Node
`MessageChannel` tests must prove:

- Two simultaneous Worker ports for one trusted Provider produce
  distinct Session IDs and independent replay windows; the same
  requestId is valid in each independent Session.
- A second Provider cannot attach to an already owner-pinned
  reverse RPC Gateway, even if URU recognizes that Provider.
- After an old Provider Session is detached, a new Provider's
  separately reviewed Gateway cannot use the previous scope.
  Host identity must always come from trusted Port/URU mapping.
- A scope revoked during noncooperative Host work is revoked across
  all active ports of the owning Gateway. Each outstanding request
  receives one correlated 403; late Host data cannot leak. Other
  exact routes remain usable. Host reservations are released only
  after underlying work actually settles.
- Tests use existing fixed concurrency limits and verify OMU EHU
  evidence; no new Worker-facing Host method or capability is added.

Security: The gateway is pinned to the first successfully created
Provider ID + Object ID. Pin ownership is immutable for the
Gateway lifetime, including when all its Sessions are detached.
A replacement Provider must be given a fresh Host-owned Gateway.
`PluginSessionUnit` continues to bind every Session to its
actual MessagePort; URU and HubUnit still decide request permission.

Load bound: Each connected Port keeps the existing 16 in-flight
(default) budget and 2-second test deadlines; the test exercises
a small fixed number of concurrent ports without increasing
Host limits. A future global multi-Provider fairness quota remains
a separate P0 acceptance condition.

Validation gate: `pr24-multi-session-vte.test.js` plus the full
Node, PR1 Browser and OCDA Browser CI suite on exact HEAD.


## PR24 Patch(+15): per-Provider fault backoff and crash quarantine

P0 PR24.85 requirements: a hostile or unstable Worker cannot
restart without bound, exhaust Host resources, or force an
unrelated Provider to stop. Restart eligibility must be controlled
by a Host-only policy, not Worker or Manifest fields.

Implementation:
- `PluginRestartCircuitPolicy`: bounded 60-second recent-fault
  window; first fault incurs 1500ms delay, second 6000ms, third
  opens a 60000ms circuit. Policy is pure and clock-injected
  in tests.
- `PluginHostInstallUnit` remembers per-Provider Worker
  faults in memory across uninstall/reinstall. Unexpected live
  Worker fault disables only its Provider and increments history;
  a subsequent explicitly consented install checks current
  restart cooldown before activation.
- A rejected start returns HTTP-like 429 and `retryAfterMs`,
  with EHU. A confirmed Host-only `resetRestartCircuit`
  removes memory history; unconsented calls return 403.
- Deliberate disable/enable/uninstall are not themselves faults.
  New unrelated Providers continue to function.

Tests: `pr24-restart-circuit-vte.test.js` exercises
pure window/backoff and the real VTE/URU Install Unit.
Browser Worker crash E2E from Patch(+12) remains intact.

Security/resource caveats: This is a Host **per-tab in-memory**
backoff, not a durable browser-wide or cross-device quarantine.
Web page reload still creates a new Installer; persistence,
multi-tab atomic restarts and CPU/memory quotas remain separate
release gates. It never resurrects disabled Providers by itself.
