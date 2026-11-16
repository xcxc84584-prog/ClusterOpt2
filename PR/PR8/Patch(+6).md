# PR8 Patch(+6) — Piece Tree and B+ auxiliary offset index

## Scope
- Added immutable, incremental text Piece Tree with split, merge,
  insert, remove, bounded read, and offset lookup.
- Added grouped B+ style leaf-offset index (fanout 32).
- Added PieceTreeIndex OCDA Object, called through HubUnit.
- Registered PieceTreePolicy and BPlusSliceIndex once via LinkCore.
- Added tests for inserts/removals/offsets, revision conflicts,
  and 100 inserts followed by 30 removals.

## EventChain
tester.Request.insert -> HubUnit -> PieceTreeIndex.Response.insert
-> PieceTreePolicy.insert -> revision increment -> Hub/OMU record.
tester.Request.locate -> HubUnit -> PieceTreeIndex.Response.locate
-> BPlusSliceIndex.seek -> Hub/OMU record.

## EHU
200 successful operation; 400 invalid offset or range;
409 expected revision mismatch; failures recorded by OMU.

## Complexity and boundaries
- Treap split/merge and point search: expected O(log P) where
  P is the number of pieces; no worst-case balancing guarantee.
- Index rebuild after mutation is lazy, O(P), and seek is O(log P).
- Read of a bounded range currently walks all preceding pieces;
  this is a foundation, not the finished large-file loading engine.
- Offsets are UTF-16 code units; byte offsets require loader mapping.
- Current main editor remains full-buffer and unchanged.
- No plugin execution, file access, or disk writeback in this patch.

## Security and recovery
- All Object requests go through HubUnit; revision validation
  prevents stale callers from overwriting the in-memory tree.
- No keys, absolute paths, dynamic code evaluation, or file writes.
- Prior release stays on main and existing PR8 branch for rollback.

Status: implemented on a feature branch; CI and browser acceptance
must pass before merge. PR8 overall remains incomplete.
