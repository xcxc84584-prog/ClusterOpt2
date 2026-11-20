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
- Request deadline: 1–30,000 ms; production queue capacity,
  fairness policy and actual effective timeout remain unimplemented.
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
