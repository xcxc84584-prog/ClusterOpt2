# PLUGIN PR04 — PRD

## Goal
HubUnit-controlled logical Service/action routing, with the existing
target-ID request path kept unchanged. One major PR with ten independently
testable small PRs, one merge only after all exact-head gates succeed.

## Planned work
- PR04.01: Service Request Resolver (this patch).
- PR04.02: declarative Route Table schema.
- PR04.03: Replace route for one API action.
- PR04.04: Chain with input/output validation.
- PR04.05: bounded Fan-out and deterministic aggregation.
- PR04.06: masked read-only Observe.
- PR04.07: Response Pipeline with EventChain integrity.
- PR04.08: Route ACL / dependency permissions.
- PR04.09: list/describe/preview read-only facade.
- PR04.10: VTE, browser and regression gate.

## Exclusions in PR04.01
No mutable routes, sandboxed external plugin code, browser route-edit
UI, file operations, new release or implicit Provider factories.

## Future multi-programming-language highlighting
The later L3 highlighter must use extensible programming-language IDs
and language-specific tokenizer/grammar Provider registration, with a
safe plain-text fallback. This is independent of the UI locale Property.

## PR04.02 scope
Immutable Route Table schema, bounded source/provider selection metadata
and validation only. No route activation, ACL elevation or Service
execution; these are gated on PR04.03–08.

## PR04.03 scope
Replace one logical Service/action Provider under a trusted, validated
in-process route table. No external route editor, agent route mutation,
manual File I/O, full transaction CAS, fanout or chain execution.

## PR04.04–05 implementation
Chain: sequential Provider route with strict per-step schema check.
Fan-out: bounded asynchronous Provider routes with deterministic
all-or-nothing aggregation. Use HubUnit authorization at every call.
Timeout metadata does not promise hard termination of running calls.

## PR04.07 implemented scope
Optional bounded declarative responsePipeline attached to a v1 Route
entry: validate, transform, fanout-only aggregate. Provider contract
compatibility checked atomically, live URU checked at request time, and
core-owned status/lineage preserved. Each hop has existing HubUnit
permission and OMU tracing. No browser route-edit API or untrusted code.

## PR04.08 implemented scope
Bounded host-only route-configuration authorization: caller-scoped
ownership, target Provider ownership, non-destructive multi-owner route
merge and static dependency cycle check. Runtime ACL remains core-owned.
An authenticated external configuration surface is deferred until a
verified principal exists; no untrusted browser API added.
