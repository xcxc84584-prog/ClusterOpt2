# PR8 Patch(+15) — Atomic Slice MVCC Prototype

## Baseline / rollback
- Parent branch: `pr8/editor-viewport-bridge-patch14`
- Parent head at branch creation:
  `3a6390df9ca822999bfdcdd79b7e1b00d7287ab8`
- Work branch: `pr8/slice-mvcc-transactions-patch15`
- Production main untouched. Patch13/14 must be reviewed first.

## Implementation
- `Implementation/property/SliceTransactionPolicy.js`:
  validated operation contracts, UTF-16 edit offsets, bounded input,
  128 operations maximum, 1 Mi UTF-16 units per slice, 64 open slices.
- `Implementation/object/SliceEditTransaction.js`:
  Object contract, Hub-facing open/transact/read/locate/info/close.
  Immutable PieceTreePolicy roots per slice, lazy BPlusSliceIndex,
  optimistic revision compare and atomic root publication.
- `Implementation/LinkCore/LinkCore.js`: EDPMU shared registration
  and centralized `SystemVersion=0.0.8-pr8.patch15`.
- `Implementation/tests/pr8-patch15-transaction.test.js`:
  insert/remove/replace, rollback, stale revision, dirty close,
  two-slice isolation, Unicode UTF-16, B+ lookup, oversized edit,
  concurrent same-revision requests.
- Updated global property registry, Plan and ArcD.

## Transaction semantics
- `open({id,text})` creates a bounded volatile slice root; revision 0.
- `transact({id,revision,operations})` applies operations to a local
  immutable candidate, then swaps the owning root iff every step passes.
- Insert and replace text are bounded and offsets count UTF-16 units.
- An invalid operation does NOT publish partial changes, revision, seed
  or an invalidated B+ index.
- A successful transaction makes the slice dirty; close rejects it
  with 409 to prevent silent data loss.
- Hub currently serializes all requests to this Object. Per-slice
  parallel scheduling has NOT been implemented or claimed.

## EHU statuses
- 200 valid, 400 malformed ID/range/operation,
  404 missing slice, 409 stale revision/dirty close,
  413 size/quantity limit; Log and Dependency recorded by HubUnit.

## Explicit limitations
- In-memory sandbox only; no durable journal, dirty recovery or
  disk writeback. This is optimistic revision control, not full
  crash-safe MVCC.
- No direct connection to main FileDocument, SliceRegistry, editor
  textarea or FileSystemHandle.
- Snapshotting UTF-16 surrogates at arbitrary boundaries must be
  guarded during future UTF-8 writeback integration.
- No UI toggle for this unfinished subsystem.
- PR8 remains NOT PASS.

## Verification before merge
```sh
npm run check
node --test Implementation/tests/pr8-patch15-transaction.test.js
npm run test:e2e
```
- Confirm EHU 400/409/413 and directed Request/Response dependencies.
- Validate invalid-operation rollback and replay revision conflict.
- Confirm current editor save/recovery regressions remain green.
- Record CI and browser evidence; do not mark PASS without it.

## Next
Patch16: durable staged slice journal/recovery and controlled
writeback design; build safe end-to-end integration only when atomic
persistence and crash recovery tests pass.
