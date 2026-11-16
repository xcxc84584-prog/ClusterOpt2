# PR8 Patch(+23): per-document slice residency and scroll reuse

## Scope
- SliceRegistry assigns visible slice guards to independent owners.
- A navigator may not erase another document's viewport protection.
- On release, remove the released slice from owner visibility guards.
- ViewportSliceController sets/releases visibility by document identity.
- Exact repeated navigation plans can reuse the resident cache without
  performing redundant Blob reads, only after checking live residency.

## EventChains
Object viewport-slices -> HubUnit -> SliceRegistry.setViewport(owner,ids)
-> OMU Request/Response and EHU; budget eviction uses union of guards.

Repeated scroll -> viewport-slices -> SliceRegistry.list -> validated
resident plan -> cached result (no SliceLoader.load).

## Cost
- Visibility union rebuild: O(total visible slice guards).
- Fast repeat: O(registry entries + visible + preloaded slices), no Blob IO.
- Different documents can remain resident subject to memory budget.
- Scheduler is async concurrency, not CPU Worker parallelism.
- A full Worker-based load/processor pipeline and fast-scroll benchmark
  remains outstanding and cannot be declared PASS.

## Tests
- Multi-document viewport and limit, dirty guard and release scenario.
- Prior slice loader, budget and VTE EventChains remain regression gates.

## Status
PARTIAL — browser rapid-scroll / stress test and true parallel Worker
processing remain open.

## CI-discovered cross-document demotion fix
- First Node run exposed a second ownership bug: Controller's final
  demotion loop still traversed slices belonging to other documents.
- Restrict demotion to IDs beginning with this document's slice prefix.
- Re-run multi-document budget/visibility and full regression CI.

## Patch(+24-Fix1) improvement
- Bounded 4-way Blob prefetch through SliceLoader.loadBatch.
- Registry admission serializes after parallel reads to preserve budget.
- Batch results reflect actual FINAL residency after later evictions.
- Repeated denied preloads are memoized until the memory budget changes.
- Speculative preloaded mode cannot demote existing full slices.
- New Node/VTE tests assert concurrency, pinned residency and retry.
