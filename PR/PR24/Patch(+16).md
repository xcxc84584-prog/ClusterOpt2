# PR24 Patch(+16) — API Catalog and OMU Load Evidence

Date: 2026-11-20. Status: PARTIAL; **not a release signoff**.
Branch: `feature/pr24-bidirectional-plugin-sdk`. PR #80 remains Draft.

## Implementation and change scope
- Added `PR/PR24/API-Contract-Catalog.md`, a source-bounded
  third-party catalog describing cluster.rpc/1, known SDK calls,
  example Provider registrations, common errors and omissions.
- Added `Implementation/tests/pr24-omu-stress-vte.test.js`.
  Checks 12,000 correlated OMU events, unique Event IDs, bounded
  retained logs, bidirectional dependencies and uncoolable failures.
- No runtime Host/Worker code, EDPMU Property or URU registration changed.

## Source and event chain
OMU.record produces new IDs for correlated results, records EHU
failures, and caps retained log history. Dependency(source,target)
tracks Request/Response. All cross-Object traffic must still go
through the existing HubUnit. A bounded retained log is **not**
durable archival persistence.

## Security and capacity
No plugin identity may be accepted from payload; no keys or
absolute paths. This patch exposes no private routes at runtime.
Stress test checks OMU contract in isolation only: it does **not**
prove real 12k Worker MessagePort throughput or crash recovery.

## Evidence
- Read and verified source: PluginBidirectionalEnvelopePolicy.js,
  ObjectManagementUnit.js, SDK example manifests and SDK README.
- GitHub commits: catalog fed26bf81fb72d2c2e411b0dff4194ab502f482e,
  stress VTE cc14101fbcfdc361779cfd4bea9bdbc6291d01d5.
- Baseline CI at a76093e622603b5107a22cd7f1d7cf3d53e2cac1:
  4/4 workflows PASS.
- New exact-HEAD CI not yet confirmed; status must be rechecked.

## Unresolved release blockers
PR24.02 source-to-runtime parity, PR24.04 complete action schemas,
PR24.05 per-route error codes, PR24.39 real high-concurrency
Worker audits, PR24.80 restore rehearsal, PR24.97 threat model,
PR24.99 merge gate and PR24.100 signoff. P1 browser/mobile/load
coverage is also outstanding. No main merge authorized.
