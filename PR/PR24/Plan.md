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
